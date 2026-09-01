import { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import { redisClient } from '../redis';

const ipfsGatewayRequestsRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ipfs-gateway-requests',
  points: EnvVars.IPFS_GATEWAY_REQUESTS_POINTS,
  duration: 30 * 24 * 60 * 60,
  blockDuration: 3600
});

const ipfsGatewayBandwidthRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ipfs-gateway-bandwidth',
  points: EnvVars.IPFS_GATEWAY_BANDWIDTH_POINTS,
  duration: 30 * 24 * 60 * 60,
  blockDuration: 3600
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

/** Does not implement rate limiting by IPFS size completely, use `assertSufficientBandwidth` before responding */
export const ipfsGatewayBandwidthRateLimitMiddleware = createRateLimitMiddleware(ipfsGatewayBandwidthRateLimiter);

export const assertSufficientBandwidth = async (req: Request, ipfsSize: number) => {
  const ip = getIp(req);

  await ipfsGatewayBandwidthRateLimiter.reward(ip, 1);
  await ipfsGatewayBandwidthRateLimiter.consume(ip, ipfsSize);
};
