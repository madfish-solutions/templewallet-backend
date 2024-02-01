import { Redis } from 'ioredis';

import { EnvVars } from './config';
import { isDefined } from './utils/helpers';
import logger from './utils/logger';

export const redisClient = new Redis(EnvVars.REDIS_URL);
redisClient.on('error', err => logger.error(err));

export const objectStorageMethodsFactory = <V, F = V>(storageKey: string, fallbackValue: F) => ({
  getByKey: async (key: string): Promise<V | F> => {
    const value = await redisClient.hget(storageKey, key);

    return isDefined(value) ? JSON.parse(value) : fallbackValue;
  },
  getAllValues: async (): Promise<Record<string, V>> => {
    const values = await redisClient.hgetall(storageKey);

    const parsedValues: Record<string, V> = {};
    for (const key in values) {
      parsedValues[key] = JSON.parse(values[key]);
    }

    return parsedValues;
  },
  upsertValues: (newValues: Record<string, V>) =>
    redisClient.hmset(
      storageKey,
      Object.fromEntries(Object.entries(newValues).map(([domain, value]) => [domain, JSON.stringify(value)]))
    ),
  removeValues: (keys: string[]) => redisClient.hdel(storageKey, ...keys)
});
