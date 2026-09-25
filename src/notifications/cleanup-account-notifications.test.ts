import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { EnvVars } from '../config';

import {
  ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY,
  ACCOUNT_NOTIFICATIONS_INDEX_PREFIX,
  getIndexTrimRank
} from './account-notifications-keys';
import { cleanupAccountNotificationsIfNeeded } from './cleanup-account-notifications';

vi.mock('../redis', () => ({
  redisClient: {}
}));

vi.mock('../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

const createCleanupRedis = ({
  info,
  lock,
  indexKeys,
  payloadKeys,
  payloads
}: {
  info: string;
  lock?: string | null;
  indexKeys?: string[];
  payloadKeys?: string[];
  payloads?: Record<string, string>;
}) => {
  const commands: Array<[string, ...unknown[]]> = [];
  const pipeline = {
    zremrangebyscore: (...args: unknown[]) => {
      commands.push(['zremrangebyscore', ...args]);

      return pipeline;
    },
    zremrangebyrank: (...args: unknown[]) => {
      commands.push(['zremrangebyrank', ...args]);

      return pipeline;
    },
    del: (...args: unknown[]) => {
      commands.push(['del', ...args]);

      return pipeline;
    },
    exec: vi.fn(async () => [])
  };

  return {
    commands,
    info: vi.fn(async () => info),
    set: vi.fn(async () => lock ?? null),
    del: vi.fn(async () => 1),
    get: vi.fn(async (key: string) => payloads?.[key] ?? null),
    scan: vi.fn(async (_cursor: string, _matchKw: string, pattern: string) => {
      if (pattern.startsWith(`${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}`)) {
        return ['0', indexKeys ?? []];
      }

      return ['0', payloadKeys ?? []];
    }),
    pipeline: vi.fn(() => pipeline)
  };
};

describe('cleanupAccountNotificationsIfNeeded', () => {
  it('does nothing when used_memory is below the watermark', async () => {
    const redis = createCleanupRedis({ info: 'used_memory:100\r\n' });

    await cleanupAccountNotificationsIfNeeded(redis as unknown as Redis);

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.scan).not.toHaveBeenCalled();
  });

  it('does nothing when another worker already holds the lock', async () => {
    const redis = createCleanupRedis({
      info: `used_memory:${EnvVars.ACCOUNT_NOTIFICATION_MEMORY_WATERMARK_BYTES}\r\n`,
      lock: null
    });

    await cleanupAccountNotificationsIfNeeded(redis as unknown as Redis);

    expect(redis.set).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY, '1', 'EX', 9 * 60, 'NX');
    expect(redis.scan).not.toHaveBeenCalled();
  });

  it('trims indexes and deletes old payloads while the lock is held', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

    try {
      const redis = createCleanupRedis({
        info: `used_memory:${EnvVars.ACCOUNT_NOTIFICATION_MEMORY_WATERMARK_BYTES}\r\n`,
        lock: 'OK',
        indexKeys: [`${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}tz1a`],
        payloadKeys: [
          'account-notifications:9',
          'account-notifications:10',
          'account-notifications:11',
          `${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}tz1a`
        ],
        payloads: {
          'account-notifications:9': JSON.stringify({ createdAt: '2010-01-01T00:00:00.000Z' }),
          'account-notifications:10': '{',
          'account-notifications:11': JSON.stringify({ createdAt: '2020-01-01T00:00:00.000Z' })
        }
      });

      await cleanupAccountNotificationsIfNeeded(redis as unknown as Redis);

      const emergencyIndexCap = Math.max(1, Math.floor(EnvVars.ACCOUNT_NOTIFICATION_INDEX_CAP / 2));
      const scoreCutoff = Date.now() - (EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS * 1000) / 2;
      expect(redis.commands[0]).toEqual([
        'zremrangebyscore',
        `${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}tz1a`,
        '-inf',
        `(${scoreCutoff}`
      ]);
      expect(redis.commands[1]).toEqual([
        'zremrangebyrank',
        `${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}tz1a`,
        0,
        getIndexTrimRank(emergencyIndexCap)
      ]);
      expect(redis.commands.filter(command => command[0] === 'del')).toEqual([['del', 'account-notifications:9']]);
      expect(redis.del).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY);
    } finally {
      vi.useRealTimers();
    }
  });
});
