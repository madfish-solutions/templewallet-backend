import { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import { redisClient } from '../redis';

const ipfsGatewayRequestsRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ipfs-gateway-requests',
  points: EnvVars.IPFS_GATEWAY_REQUESTS_POINTS,
  duration: 30 * 24 * 60 * 60
});

const ipfsGatewayBandwidthRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ipfs-gateway-bandwidth',
  points: EnvVars.IPFS_GATEWAY_BANDWIDTH_POINTS,
  duration: 30 * 24 * 60 * 60
});

const getIp = (req: Request) => (req.headers['do-connecting-ip'] ?? req.ip) as string;

const createRateLimitMiddleware = (limiter: RateLimiterRedis) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await limiter.consume(getIp(req), 1);

      return next();
    } catch (error) {
      res.status(429);

      if (error instanceof RateLimiterRes) {
        res.setHeader('Retry-After', Math.ceil(error.msBeforeNext / 1000));
      }

      res.json({
        error: 'Too many requests. Please try again later'
      });
    }
  };
};

export const ipfsGatewayRequestsRateLimitMiddleware = createRateLimitMiddleware(ipfsGatewayRequestsRateLimiter);

/** Cheap blocked-IP probe; actual bytes are consumed atomically in `pipeGatewayBody`. */
export const ipfsGatewayBandwidthRateLimitMiddleware = createRateLimitMiddleware(ipfsGatewayBandwidthRateLimiter);

/** Fast-fail oversized `Content-Length`. Concurrent transfers are enforced by `consumeBandwidth`. */
export const assertFitsBandwidth = async (req: Request, bytes: number) => {
  const limiterRes = await ipfsGatewayBandwidthRateLimiter.get(getIp(req));
  const available = limiterRes === null ? ipfsGatewayBandwidthRateLimiter.points : limiterRes.remainingPoints + 1;
  const msBeforeNext = limiterRes === null ? ipfsGatewayBandwidthRateLimiter.msDuration : limiterRes.msBeforeNext;

  if (bytes > available) {
    throw limiterRes ?? new RateLimiterRes(0, msBeforeNext);
  }

  return msBeforeNext;
};

/** Undo the 1-byte middleware probe once we decide to serve the body. */
export const refundBandwidthProbe = async (req: Request) => {
  await ipfsGatewayBandwidthRateLimiter.reward(getIp(req), 1);
};

/** Atomically charge `bytes` against the shared per-IP quota. */
export const consumeBandwidth = async (req: Request, bytes: number) => {
  if (bytes <= 0) {
    return;
  }

  await ipfsGatewayBandwidthRateLimiter.consume(getIp(req), bytes);
};
