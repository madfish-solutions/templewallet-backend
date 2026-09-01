import { Request, Response, Router } from 'express';
import { CID } from 'multiformats/cid';
import { Writable } from 'node:stream';
import { RateLimiterRes } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import { isDefined } from '../utils/helpers';
import logger from '../utils/logger';
import {
  assertFitsBandwidth,
  consumeBandwidth,
  ipfsGatewayBandwidthRateLimitMiddleware,
  ipfsGatewayRequestsRateLimitMiddleware
} from '../utils/rate-limiters';

export const ipfsRouter = Router();

const parseContentLength = (response: globalThis.Response) => {
  const raw = response.headers.get('content-length') ?? response.headers.get('Content-Length');
  if (!isDefined(raw)) {
    return undefined;
  }

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

const sendTooManyRequests = (res: Response, retryAfterMs: number) =>
  res
    .status(429)
    .setHeader('Retry-After', Math.ceil(retryAfterMs / 1000))
    .json({ error: 'Too many requests. Please try again later' });

const buildGatewayUrl = (req: Request) => {
  const gatewayUrl = new URL(EnvVars.PINATA_GATEWAY_URL);
  gatewayUrl.pathname = `/ipfs${req.path}`;
  for (const key in req.query) {
    gatewayUrl.searchParams.set(key, req.query[key] as string);
  }
  gatewayUrl.searchParams.set('pinataGatewayToken', EnvVars.PINATA_GATEWAY_KEY);

  return gatewayUrl;
};

const rejectIfNotOk = async (response: globalThis.Response, res: Response, abortUpstream: () => void) => {
  if (response.status === 404) {
    abortUpstream();
    res.status(404).json({ error: 'Not found' });

    return true;
  }

  if (response.status !== 200) {
    logger.error({ status: response.status, text: await response.text() }, 'Failed to fetch IPFS content');
    res.status(500).json({ error: 'Failed to fetch IPFS content' });

    return true;
  }

  return false;
};

const handleProxyError = (
  error: unknown,
  res: Response,
  streamState: { bandwidthExceeded: boolean },
  msBeforeNext: number,
  abortUpstream: () => void
) => {
  abortUpstream();

  if (error instanceof RateLimiterRes || streamState.bandwidthExceeded) {
    if (res.headersSent) {
      res.destroy();

      return;
    }

    sendTooManyRequests(res, error instanceof RateLimiterRes ? error.msBeforeNext : msBeforeNext);

    return;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return;
  }

  logger.error(error as Error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const pipeGatewayBody = async (
  body: ReadableStream<Uint8Array>,
  res: Response,
  availableBandwidth: number,
  abortController: AbortController,
  streamState: { transferred: number; bandwidthExceeded: boolean }
) => {
  await body.pipeTo(
    Writable.toWeb(
      new Writable({
        objectMode: false,
        write(chunk, _enc, cb) {
          const chunkSize = Buffer.byteLength(chunk);
          if (streamState.transferred + chunkSize > availableBandwidth) {
            streamState.bandwidthExceeded = true;
            abortController.abort();
            cb(new Error('Bandwidth limit exceeded'));

            return;
          }

          streamState.transferred += chunkSize;
          res.write(chunk, cb);
        }
      })
    ),
    { signal: abortController.signal }
  );
};

ipfsRouter.get(
  '/**',
  (req, res, next) => {
    const [cid] = req.path.split('/').filter(Boolean);

    if (!cid) {
      return res.status(400).json({ error: 'No CID provided' });
    }

    try {
      CID.parse(cid);

      return next();
    } catch (error) {
      logger.error(error as Error);
      res.status(400).json({ error: 'Invalid CID' });
    }
  },
  ipfsGatewayRequestsRateLimitMiddleware,
  ipfsGatewayBandwidthRateLimitMiddleware,
  async (req, res) => {
    const abortController = new AbortController();
    const abortUpstream = () => abortController.abort();
    res.once('close', abortUpstream);

    const streamState = { transferred: 0, bandwidthExceeded: false };
    let startedStreaming = false;
    let msBeforeNext = 0;

    try {
      const response = await fetch(buildGatewayUrl(req).toString(), { signal: abortController.signal });

      if (await rejectIfNotOk(response, res, abortUpstream)) {
        return;
      }

      const contentLength = parseContentLength(response);
      const bandwidth = await assertFitsBandwidth(req, contentLength ?? 1);
      msBeforeNext = bandwidth.msBeforeNext;

      res
        .status(200)
        .setHeader(
          'Content-Type',
          response.headers.get('Content-Type') ?? response.headers.get('content-type') ?? 'application/octet-stream'
        )
        .setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (!response.body) {
        startedStreaming = true;

        return res.send();
      }

      startedStreaming = true;
      await pipeGatewayBody(response.body, res, bandwidth.available, abortController, streamState);
      res.end();
    } catch (error) {
      handleProxyError(error, res, streamState, msBeforeNext, abortUpstream);
    } finally {
      res.off('close', abortUpstream);

      if (!startedStreaming) {
        return;
      }

      try {
        await consumeBandwidth(req, streamState.transferred);
      } catch (error) {
        if (!(error instanceof RateLimiterRes)) {
          logger.error(error as Error);
        }
      }
    }
  }
);
