import { Router } from 'express';
import { CID } from 'multiformats/cid';
import { Writable } from 'node:stream';
import { RateLimiterRes } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import logger from '../utils/logger';
import {
  assertSufficientBandwidth,
  ipfsGatewayBandwidthRateLimitMiddleware,
  ipfsGatewayRequestsRateLimitMiddleware
} from '../utils/rate-limiters';

export const ipfsRouter = Router();

ipfsRouter.get(
  '/**',
  (req, res, next) => {
    const [cid] = req.path.split('/').filter(Boolean);

    if (cid && CID.asCID(cid)) {
      return next();
    }

    res.status(400).json({ error: 'Invalid CID' });
  },
  ipfsGatewayRequestsRateLimitMiddleware,
  ipfsGatewayBandwidthRateLimitMiddleware,
  async (req, res) => {
    try {
      const gatewayUrl = new URL(EnvVars.PINATA_GATEWAY_URL);
      gatewayUrl.pathname = `/ipfs${req.path}`;
      for (const key in req.query) {
        gatewayUrl.searchParams.set(key, req.query[key] as string);
      }
      gatewayUrl.searchParams.set('pinataGatewayToken', EnvVars.PINATA_GATEWAY_KEY);
      const response = await fetch(gatewayUrl.toString());

      if (response.status === 404) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (response.status !== 200) {
        logger.error({ status: response.status, text: await response.text() }, 'Failed to fetch IPFS content');

        return res.status(500).json({ error: 'Failed to fetch IPFS content' });
      }

      const contentLength = Number(response.headers.get('content-length') ?? response.headers.get('Content-Length'));
      await assertSufficientBandwidth(req, contentLength);

      res
        .status(200)
        .setHeader(
          'Content-Type',
          response.headers.get('Content-Type') ?? response.headers.get('content-type') ?? 'application/octet-stream'
        )
        .setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (!response.body) {
        return res.send();
      }

      await response.body.pipeTo(
        Writable.toWeb(new Writable({ objectMode: false, write: (chunk, _enc, cb) => res.write(chunk, cb) }))
      );
      res.end();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return res
          .status(429)
          .setHeader('Retry-After', Math.ceil(error.msBeforeNext / 1000))
          .json({ error: 'Too many requests. Please try again later' });
      }

      logger.error(error as Error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);
