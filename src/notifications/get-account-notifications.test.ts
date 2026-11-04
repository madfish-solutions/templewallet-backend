import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { getAccountNotificationIndexKey, getAccountNotificationKey } from './account-notifications-keys';
import { getAccountNotifications } from './get-account-notifications';
import { Notification, NotificationType, PlatformType } from './notification.interface';

const PAST = '2020-01-01T00:00:00.000Z';
const PAST_MS = Date.parse(PAST);
const SAME_TIME_LATER_ID = '2020-01-01T01:00:00.000Z';
const SAME_TIME_LATER_MS = Date.parse(SAME_TIME_LATER_ID);

const payload = (overrides: Partial<Notification> & Pick<Notification, 'id' | 'createdAt' | 'type'>): string =>
  JSON.stringify({
    language: 'en-US',
    title: 'title',
    description: 'description',
    content: ['description'],
    extensionImageUrl: 'https://icon.test',
    mobileImageUrl: 'https://icon.test',
    platforms: [PlatformType.Mobile, PlatformType.Extension],
    ...overrides
  });

const createReadRedis = (indexes: Record<string, string[]>, payloads: Record<string, string | null>) => ({
  pipeline: () => {
    const keys: string[] = [];
    const pipeline = {
      zrangebyscore: (key: string, minScore: number, maxScore: string) => {
        keys.push(key);
        expect(maxScore).toBe('+inf');
        expect(Number.isFinite(minScore)).toBe(true);

        return pipeline;
      },
      exec: async () => keys.map(key => [null, indexes[key] ?? []])
    };

    return pipeline;
  },
  mget: async (...keys: string[]) => keys.map(key => payloads[key] ?? null)
});

describe('getAccountNotifications', () => {
  it('returns an empty list when no addresses are given', async () => {
    const redis = createReadRedis({}, {});

    await expect(getAccountNotifications(redis as unknown as Redis, [])).resolves.toEqual([]);
  });

  it('returns account notifications after the (time, id) cursor, newest first', async () => {
    const older = payload({
      id: 1,
      createdAt: PAST,
      type: NotificationType.OfferReceived
    });
    const newerLowId = payload({
      id: 2,
      createdAt: SAME_TIME_LATER_ID,
      type: NotificationType.AuctionBid
    });
    const newerHighId = payload({
      id: 3,
      createdAt: SAME_TIME_LATER_ID,
      type: NotificationType.NftSold
    });
    const redis = createReadRedis(
      {
        [getAccountNotificationIndexKey('tz1a')]: ['2', '3'],
        [getAccountNotificationIndexKey('tz1b')]: ['3']
      },
      {
        [getAccountNotificationKey(1)]: older,
        [getAccountNotificationKey(2)]: newerLowId,
        [getAccountNotificationKey(3)]: newerHighId
      }
    );

    const results = await getAccountNotifications(redis as unknown as Redis, ['tz1a', 'tz1b'], SAME_TIME_LATER_MS, 2);

    expect(results.map(item => item.id)).toEqual([3]);
    expect(results[0].accountAddresses).toEqual(['tz1a', 'tz1b']);
    expect(results[0].type).toBe(NotificationType.NftSold);
  });

  it('drops missing payloads, broadcast types, expired rows, and corrupt JSON', async () => {
    const redis = createReadRedis(
      { [getAccountNotificationIndexKey('tz1a')]: ['1', '2', '3', '4', '5', '6'] },
      {
        [getAccountNotificationKey(1)]: null,
        [getAccountNotificationKey(2)]: payload({
          id: 2,
          createdAt: PAST,
          type: NotificationType.News
        }),
        [getAccountNotificationKey(3)]: payload({
          id: 3,
          createdAt: PAST,
          type: NotificationType.OfferReceived,
          expirationDate: '2019-12-31T00:00:00.000Z'
        }),
        [getAccountNotificationKey(4)]: '{',
        [getAccountNotificationKey(5)]: 'null',
        [getAccountNotificationKey(6)]: payload({
          id: 6,
          createdAt: '2099-01-01T00:00:00.000Z',
          type: NotificationType.OfferReceived
        })
      }
    );

    await expect(getAccountNotifications(redis as unknown as Redis, ['tz1a'])).resolves.toEqual([]);
  });

  it('returns an empty list when index reads fail or exec is incomplete', async () => {
    const mget = vi.fn();
    const incomplete = {
      pipeline: () => {
        const pipeline = {
          zrangebyscore: () => pipeline,
          exec: async () => null
        };

        return pipeline;
      },
      mget
    };

    await expect(getAccountNotifications(incomplete as unknown as Redis, ['tz1a'])).resolves.toEqual([]);
    expect(mget).not.toHaveBeenCalled();

    const failed = {
      pipeline: () => {
        const pipeline = {
          zrangebyscore: () => pipeline,
          exec: async () => [[new Error('zrange failed'), null]]
        };

        return pipeline;
      },
      mget
    };

    await expect(getAccountNotifications(failed as unknown as Redis, ['tz1a'])).resolves.toEqual([]);
    expect(mget).not.toHaveBeenCalled();
  });

  it('keeps valid rows when sibling payloads are corrupt', async () => {
    const redis = createReadRedis(
      { [getAccountNotificationIndexKey('tz1a')]: ['1', '2'] },
      {
        [getAccountNotificationKey(1)]: '{',
        [getAccountNotificationKey(2)]: payload({
          id: 2,
          createdAt: PAST,
          type: NotificationType.OfferReceived
        })
      }
    );

    const results = await getAccountNotifications(redis as unknown as Redis, ['tz1a']);

    expect(results.map(item => item.id)).toEqual([2]);
  });

  it('keeps mobile-only account notifications when they are requested by address', async () => {
    const redis = createReadRedis(
      { [getAccountNotificationIndexKey('tz1a')]: ['3'] },
      {
        [getAccountNotificationKey(3)]: payload({
          id: 3,
          createdAt: PAST,
          type: NotificationType.OfferReceived,
          platforms: [PlatformType.Mobile]
        })
      }
    );

    const results = await getAccountNotifications(redis as unknown as Redis, ['tz1a']);

    expect(results.map(item => item.id)).toEqual([3]);
  });

  it('sorts by createdAt descending and uses id as a tiebreaker', async () => {
    const redis = createReadRedis(
      { [getAccountNotificationIndexKey('tz1a')]: ['1', '2', '3'] },
      {
        [getAccountNotificationKey(1)]: payload({
          id: 1,
          createdAt: SAME_TIME_LATER_ID,
          type: NotificationType.OfferReceived
        }),
        [getAccountNotificationKey(2)]: payload({
          id: 2,
          createdAt: SAME_TIME_LATER_ID,
          type: NotificationType.AuctionBid
        }),
        [getAccountNotificationKey(3)]: payload({
          id: 3,
          createdAt: PAST,
          type: NotificationType.NftSold
        })
      }
    );

    const results = await getAccountNotifications(redis as unknown as Redis, ['tz1a']);

    expect(results.map(item => item.id)).toEqual([2, 1, 3]);
    expect(PAST_MS).toBeLessThan(SAME_TIME_LATER_MS);
  });
});
