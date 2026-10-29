import { RateLimiterRedis } from 'rate-limiter-flexible';

import { redisClient } from '../redis';

import logger from './logger';

const pinataGatewayCallsCounter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'pinata-gateway-calls',
  points: 10_000,
  duration: 30 * 24 * 60 * 60
});

export const countPinataGatewayCall = (account: number) =>
  pinataGatewayCallsCounter
    .penalty(String(account), 1)
    .catch((error: unknown) => logger.error({ error }, 'Failed to count a Pinata gateway call'));

export const getPinataGatewayUsage = async (accountsCount: number) => {
  const accounts = await Promise.all(
    Array.from({ length: accountsCount }, async (_, index) => {
      const account = index + 1;
      const usage = await pinataGatewayCallsCounter.get(String(account));

      return {
        account,
        calls: usage?.consumedPoints ?? 0,
        windowEndsAt: usage ? new Date(Date.now() + usage.msBeforeNext).toISOString() : null
      };
    })
  );

  return {
    accounts,
    totalCalls: accounts.reduce((sum, { calls }) => sum + calls, 0),
    quota: accountsCount * pinataGatewayCallsCounter.points
  };
};
