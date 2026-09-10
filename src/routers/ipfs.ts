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
  ipfsGatewayRequestsRateLimitMiddleware,
  refundBandwidthProbe
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
  streamState: { bandwidthExceeded: boolean; msBeforeNext: number },
  abortUpstream: () => void
) => {
  abortUpstream();

  if (error instanceof RateLimiterRes || streamState.bandwidthExceeded) {
    if (res.headersSent) {
      res.destroy();

      return;
    }

    sendTooManyRequests(res, error instanceof RateLimiterRes ? error.msBeforeNext : streamState.msBeforeNext);

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

const toWritableError = (error: unknown) => (error instanceof Error ? error : new Error('Bandwidth limit exceeded'));

const pipeGatewayBody = async (
  req: Request,
  body: ReadableStream<Uint8Array>,
  res: Response,
  abortController: AbortController,
  streamState: { bandwidthExceeded: boolean; msBeforeNext: number }
) => {
  await body.pipeTo(
    Writable.toWeb(
      new Writable({
        objectMode: false,
        write(chunk, _enc, cb) {
          const chunkSize = Buffer.byteLength(chunk);

          void consumeBandwidth(req, chunkSize)
            .then(() => {
              res.write(chunk, cb);
            })
            .catch((error: unknown) => {
              if (error instanceof RateLimiterRes) {
                streamState.bandwidthExceeded = true;
                streamState.msBeforeNext = error.msBeforeNext;
                abortController.abort();
              }

              cb(toWritableError(error));
            });
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

    const streamState = { bandwidthExceeded: false, msBeforeNext: 0 };

    try {
      const response = await fetch(buildGatewayUrl(req).toString(), { signal: abortController.signal });

      if (await rejectIfNotOk(response, res, abortUpstream)) {
        return;
      }

      const contentLength = parseContentLength(response);
      streamState.msBeforeNext = await assertFitsBandwidth(req, contentLength ?? 1);
      await refundBandwidthProbe(req);

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

      await pipeGatewayBody(req, response.body, res, abortController, streamState);
      res.end();
    } catch (error) {
      handleProxyError(error, res, streamState, abortUpstream);
    } finally {
      res.off('close', abortUpstream);
    }
  }
);
