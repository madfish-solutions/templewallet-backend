import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { EnvVars } from '../config';

import {
  ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL,
  getAccountNotificationIndexKey,
  getAccountNotificationKey,
  getIndexTrimRank
} from './account-notifications-keys';
import { addAccountNotifications } from './add-account-notifications';
import { NotificationType, PlatformType } from './notification.interface';

const defaultExecReplies = (commands: Array<[string, ...unknown[]]>): Array<[Error | null, unknown]> =>
  commands.map(command => (command[0] === 'set' ? [null, 'OK'] : [null, 1]));

const createRecordingRedis = (
  execReplies: (commands: Array<[string, ...unknown[]]>) => Array<[Error | null, unknown]> | null = defaultExecReplies
) => {
  const commands: Array<[string, ...unknown[]]> = [];
  const pipeline = {
    set: (...args: unknown[]) => {
      commands.push(['set', ...args]);

      return pipeline;
    },
    zadd: (...args: unknown[]) => {
      commands.push(['zadd', ...args]);

      return pipeline;
    },
    expire: (...args: unknown[]) => {
      commands.push(['expire', ...args]);

      return pipeline;
    },
    zremrangebyrank: (...args: unknown[]) => {
      commands.push(['zremrangebyrank', ...args]);

      return pipeline;
    },
    exec: vi.fn(async () => execReplies(commands))
  };

  return {
    commands,
    pipeline: vi.fn(() => pipeline),
    publish: vi.fn(async () => 1)
  };
};

const offerInput = (accountAddresses: string[], expirationDate?: string, id = 42) => ({
  notification: {
    id,
    createdAt: '2020-01-01T00:00:00.000Z',
    type: NotificationType.OfferReceived as const,
    language: 'en-US',
    title: 'New offer for 1.5 tez',
    description: 'On Tezzard',
    content: ['On Tezzard'],
    extensionImageUrl: 'https://icon.test',
    mobileImageUrl: 'https://icon.test',
    expirationDate
  },
  accountAddresses
});

const storedOffer = (accountAddresses: string[], id = 42) => ({
  ...offerInput(accountAddresses, undefined, id).notification,
  platforms: [PlatformType.Mobile, PlatformType.Extension],
  accountAddresses
});

describe('addAccountNotifications', () => {
  it('does nothing for an empty list', async () => {
    const redis = createRecordingRedis();

    await addAccountNotifications(redis as unknown as Redis, []);

    expect(redis.pipeline).not.toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('stores mobile and extension payloads with NX TTL and caps each address index', async () => {
    const redis = createRecordingRedis();
    const createdAtTimestamp = Date.parse('2020-01-01T00:00:00.000Z');

    await addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a', 'tz1b'])]);

    expect(redis.commands).toEqual([
      [
        'set',
        getAccountNotificationKey(42),
        JSON.stringify({
          ...offerInput(['tz1a', 'tz1b']).notification,
          platforms: [PlatformType.Mobile, PlatformType.Extension]
        }),
        'EX',
        EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS,
        'NX'
      ],
      ['zadd', getAccountNotificationIndexKey('tz1a'), createdAtTimestamp, '42'],
      ['expire', getAccountNotificationIndexKey('tz1a'), EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS],
      [
        'zremrangebyrank',
        getAccountNotificationIndexKey('tz1a'),
        0,
        getIndexTrimRank(EnvVars.ACCOUNT_NOTIFICATION_INDEX_CAP)
      ],
      ['zadd', getAccountNotificationIndexKey('tz1b'), createdAtTimestamp, '42'],
      ['expire', getAccountNotificationIndexKey('tz1b'), EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS],
      [
        'zremrangebyrank',
        getAccountNotificationIndexKey('tz1b'),
        0,
        getIndexTrimRank(EnvVars.ACCOUNT_NOTIFICATION_INDEX_CAP)
      ]
    ]);
    expect(redis.pipeline().exec).toHaveBeenCalledOnce();
    expect(redis.publish).toHaveBeenCalledOnce();
    expect(redis.publish).toHaveBeenCalledWith(
      ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL,
      JSON.stringify([storedOffer(['tz1a', 'tz1b'])])
    );
  });

  it('skips items with no addresses or an expiration already in the past', async () => {
    const redis = createRecordingRedis();

    await addAccountNotifications(redis as unknown as Redis, [
      offerInput([]),
      offerInput(['tz1a'], '2019-01-01T00:00:00.000Z')
    ]);

    expect(redis.commands).toEqual([]);
    expect(redis.pipeline().exec).toHaveBeenCalledOnce();
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('does not republish a notification whose payload key already exists', async () => {
    const redis = createRecordingRedis(commands =>
      commands.map(command => (command[0] === 'set' ? [null, null] : [null, 1]))
    );

    await addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'])]);

    expect(redis.commands[0]?.[0]).toBe('set');
    expect(redis.commands[0]?.[5]).toBe('NX');
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('publishes only newly stored notifications in a mixed batch', async () => {
    const redis = createRecordingRedis(commands =>
      commands.map(command => {
        if (command[0] !== 'set') {
          return [null, 1];
        }

        return command[1] === getAccountNotificationKey(42) ? [null, 'OK'] : [null, null];
      })
    );

    await addAccountNotifications(redis as unknown as Redis, [
      offerInput(['tz1a'], undefined, 42),
      offerInput(['tz1b'], undefined, 43)
    ]);

    expect(redis.publish).toHaveBeenCalledOnce();
    expect(redis.publish).toHaveBeenCalledWith(
      ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL,
      JSON.stringify([storedOffer(['tz1a'], 42)])
    );
  });

  it('does not publish when a payload write fails', async () => {
    const writeError = new Error('READONLY');
    const redis = createRecordingRedis(commands =>
      commands.map(command => (command[0] === 'set' ? [writeError, null] : [null, 1]))
    );

    await expect(addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'])])).rejects.toBe(writeError);
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('publishes newly stored events and still fails when a later index write errors', async () => {
    const indexError = new Error('zadd failed');
    const redis = createRecordingRedis(commands =>
      commands.map(command => {
        if (command[0] === 'set') {
          return [null, 'OK'];
        }

        if (command[0] === 'zadd') {
          return [indexError, null];
        }

        return [null, 1];
      })
    );

    await expect(addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'])])).rejects.toBe(indexError);
    expect(redis.publish).toHaveBeenCalledWith(
      ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL,
      JSON.stringify([storedOffer(['tz1a'])])
    );
  });

  it('does not publish when the pipeline returns an incomplete result', async () => {
    const redis = createRecordingRedis(() => null);

    await expect(addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'])])).rejects.toThrow(
      'Account notifications Redis pipeline returned an incomplete result'
    );
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('stores history without publishing when publish is false', async () => {
    const redis = createRecordingRedis();

    await addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'])], { publish: false });

    expect(redis.commands[0]?.[0]).toBe('set');
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('uses the remaining expiration as payload TTL when it is shorter than the default', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

    try {
      const redis = createRecordingRedis();

      await addAccountNotifications(redis as unknown as Redis, [offerInput(['tz1a'], '2020-01-01T00:00:10.000Z')]);

      expect(redis.commands[0]?.[3]).toBe('EX');
      expect(redis.commands[0]?.[4]).toBe(10);
      expect(redis.commands[0]?.[5]).toBe('NX');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects unsupported notification types', async () => {
    const redis = createRecordingRedis();

    await expect(
      addAccountNotifications(
        redis as unknown as Redis,
        [
          {
            notification: {
              ...offerInput(['tz1a']).notification,
              type: NotificationType.News
            },
            accountAddresses: ['tz1a']
          }
        ] as never
      )
    ).rejects.toThrow('Unsupported account notification type: News');
    expect(redis.pipeline().exec).not.toHaveBeenCalled();
    expect(redis.publish).not.toHaveBeenCalled();
  });
});
