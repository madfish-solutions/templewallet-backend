import { Redis } from 'ioredis';

import { EnvVars } from '../config';
import { redisClient } from '../redis';
import { isDefined, isNonEmptyString } from '../utils/helpers';
import logger from '../utils/logger';

import {
  ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY,
  ACCOUNT_NOTIFICATIONS_INDEX_PREFIX,
  ACCOUNT_NOTIFICATIONS_PREFIX,
  getIndexTrimRank
} from './account-notifications-keys';

const SCAN_COUNT = 200;
const PIPELINE_FLUSH_EVERY = 100;
const CLEANUP_LOCK_TTL_SECONDS = 9 * 60;

const parseUsedMemoryBytes = (info: string) => {
  const match = /used_memory:(\d+)/.exec(info);
  if (!isDefined(match)) {
    return undefined;
  }

  return Number(match[1]);
};

const scanKeys = async (client: Redis, match: string, onKey: (key: string) => Promise<void> | void) => {
  let cursor = '0';

  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', SCAN_COUNT);
    cursor = String(nextCursor);

    for (const key of keys) {
      await onKey(key);
    }
  } while (cursor !== '0');
};

const createFlushingPipeline = (client: Redis) => {
  let pipeline = client.pipeline();
  let queued = 0;

  const flush = async () => {
    if (queued === 0) {
      return;
    }

    await pipeline.exec();
    pipeline = client.pipeline();
    queued = 0;
  };

  const queue = async (enqueue: (nextPipeline: ReturnType<Redis['pipeline']>) => void) => {
    enqueue(pipeline);
    queued += 1;

    if (queued >= PIPELINE_FLUSH_EVERY) {
      await flush();
    }
  };

  return { queue, flush };
};

const trimIndexes = async (client: Redis, scoreCutoff: number, indexCap: number) => {
  const { queue, flush } = createFlushingPipeline(client);
  const trimRank = getIndexTrimRank(indexCap);

  await scanKeys(client, `${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}*`, async key => {
    await queue(pipeline => {
      pipeline.zremrangebyscore(key, '-inf', `(${scoreCutoff}`);
      pipeline.zremrangebyrank(key, 0, trimRank);
    });
  });

  await flush();
};

const deleteOldPayloads = async (client: Redis, scoreCutoff: number) => {
  const { queue, flush } = createFlushingPipeline(client);
  const payloadPrefix = `${ACCOUNT_NOTIFICATIONS_PREFIX}:`;

  await scanKeys(client, `${payloadPrefix}*`, async key => {
    if (key.startsWith(ACCOUNT_NOTIFICATIONS_INDEX_PREFIX)) {
      return;
    }

    const payload = await client.get(key);
    if (!isNonEmptyString(payload)) {
      return;
    }

    try {
      const notification: { createdAt?: string } = JSON.parse(payload);
      if (!isNonEmptyString(notification.createdAt) || new Date(notification.createdAt).getTime() >= scoreCutoff) {
        return;
      }
    } catch {
      return;
    }

    await queue(pipeline => {
      pipeline.del(key);
    });
  });

  await flush();
};

export const cleanupAccountNotificationsIfNeeded = async (client: Redis) => {
  const info = await client.info('memory');
  const usedMemoryBytes = parseUsedMemoryBytes(info);
  if (!isDefined(usedMemoryBytes) || usedMemoryBytes < EnvVars.ACCOUNT_NOTIFICATION_MEMORY_WATERMARK_BYTES) {
    return;
  }

  const lock = await client.set(ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY, '1', 'EX', CLEANUP_LOCK_TTL_SECONDS, 'NX');
  if (lock !== 'OK') {
    return;
  }

  const emergencyScoreCutoff = Date.now() - (EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS * 1000) / 2;
  const emergencyIndexCap = Math.max(1, Math.floor(EnvVars.ACCOUNT_NOTIFICATION_INDEX_CAP / 2));

  logger.warn(
    `Account notifications cleanup started: used_memory=${usedMemoryBytes} watermark=${EnvVars.ACCOUNT_NOTIFICATION_MEMORY_WATERMARK_BYTES}`
  );

  try {
    await trimIndexes(client, emergencyScoreCutoff, emergencyIndexCap);
    await deleteOldPayloads(client, emergencyScoreCutoff);
  } finally {
    await client.del(ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY);
  }
};

let cleanupInterval: NodeJS.Timeout | undefined;

export const startAccountNotificationsCleanup = () => {
  if (isDefined(cleanupInterval)) {
    return;
  }

  cleanupInterval = setInterval(() => {
    cleanupAccountNotificationsIfNeeded(redisClient).catch(error => {
      logger.error('Account notifications cleanup failed', error);
    });
  }, EnvVars.ACCOUNT_NOTIFICATION_CLEANUP_INTERVAL_MS);
};
