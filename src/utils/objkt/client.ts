import axios, { AxiosError } from 'axios';

import { isDefined } from '../helpers';
import logger from '../logger';
import PromisifiedSemaphore from '../PromisifiedSemaphore';

import { ObjktGraphqlResponse, ObjktPageParams } from './types';

const OBJKT_GRAPHQL_ENDPOINT = 'https://data.objkt.com/v3/graphql';

/** Official cap is 500, but that often times out; start smaller and shrink further on timeout. */
const OBJKT_PAGE_SIZE = 100;
const OBJKT_MIN_PAGE_SIZE = 10;

/** Official cap is 120 req/min; stay a bit lower to leave room for retries. */
const OBJKT_MAX_REQUESTS_PER_MINUTE = 100;
const OBJKT_REQUEST_WINDOW_MS = 60_000;
const OBJKT_MAX_CONCURRENT_REQUESTS = 2;
const OBJKT_MAX_RETRIES = 5;
const OBJKT_RETRY_BASE_DELAY_MS = 500;
const OBJKT_RETRY_MAX_DELAY_MS = 30_000;
const OBJKT_REQUEST_TIMEOUT_MS = 30_000;

/** Same-payload retries (rate limits, transient server errors). Timeouts use a smaller page instead. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);
const TIMEOUT_STATUS_CODES = new Set([408, 504]);
const RETRYABLE_GRAPHQL_MESSAGE = /too many|rate.?limit|try again|temporar|overloaded/i;
const TIMEOUT_MESSAGE = /timeout/i;

const requestSemaphore = new PromisifiedSemaphore(OBJKT_MAX_CONCURRENT_REQUESTS);
const requestTimestamps: number[] = [];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const toRetryDelayMs = (attempt: number, retryAfterMs?: number) => {
  if (isDefined(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, OBJKT_RETRY_MAX_DELAY_MS);
  }

  const exponentialDelay = OBJKT_RETRY_BASE_DELAY_MS * 2 ** attempt;
  const jitter = 0.5 + Math.random() * 0.5;

  return Math.min(OBJKT_RETRY_MAX_DELAY_MS, exponentialDelay * jitter);
};

const parseRetryAfterMs = (error: AxiosError) => {
  const retryAfter = error.response?.headers['retry-after'];
  if (!isDefined(retryAfter)) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfter);
  if (Number.isNaN(retryAfterSeconds)) {
    return undefined;
  }

  return retryAfterSeconds * 1000;
};

const isTimeoutError = (error: unknown) => {
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    const status = error.response?.status;
    if (isDefined(status) && TIMEOUT_STATUS_CODES.has(status)) {
      return true;
    }

    return TIMEOUT_MESSAGE.test(error.message);
  }

  return error instanceof Error && TIMEOUT_MESSAGE.test(error.message);
};

const getRetryDelayMs = (error: unknown, attempt: number) => {
  if (isTimeoutError(error)) {
    return undefined;
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (isDefined(status) && RETRYABLE_STATUS_CODES.has(status)) {
      return toRetryDelayMs(attempt, parseRetryAfterMs(error));
    }

    if (!isDefined(error.response)) {
      return toRetryDelayMs(attempt);
    }

    return undefined;
  }

  if (error instanceof Error && RETRYABLE_GRAPHQL_MESSAGE.test(error.message)) {
    return toRetryDelayMs(attempt);
  }

  return undefined;
};

const nextSmallerPageSize = (limit: number) => Math.max(OBJKT_MIN_PAGE_SIZE, Math.floor(limit / 2));

const waitForRateLimitSlot = async () => {
  while (true) {
    const now = Date.now();
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] >= OBJKT_REQUEST_WINDOW_MS) {
      requestTimestamps.shift();
    }

    if (requestTimestamps.length < OBJKT_MAX_REQUESTS_PER_MINUTE) {
      requestTimestamps.push(now);

      return;
    }

    await sleep(requestTimestamps[0] + OBJKT_REQUEST_WINDOW_MS - now + 10);
  }
};

const toObjktTimestamp = (since: Date | string) => {
  const date = since instanceof Date ? since : new Date(since);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Objkt since date: ${String(since)}`);
  }

  return date.toISOString();
};

export const objktGraphql = async <T>(query: string, variables: Record<string, unknown>) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= OBJKT_MAX_RETRIES; attempt++) {
    try {
      const response = await new Promise<ObjktGraphqlResponse<T>>((resolve, reject) => {
        requestSemaphore
          .exec(async () => {
            try {
              await waitForRateLimitSlot();

              const { data } = await axios.post<ObjktGraphqlResponse<T>>(
                OBJKT_GRAPHQL_ENDPOINT,
                { query, variables },
                {
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                  },
                  timeout: OBJKT_REQUEST_TIMEOUT_MS
                }
              );

              resolve(data);
            } catch (error) {
              reject(error);
            }
          })
          .catch(reject);
      });

      if (isDefined(response.errors) && response.errors.length > 0) {
        throw new Error(response.errors.map(error => error.message).join('; '));
      }

      if (!isDefined(response.data)) {
        throw new Error('Objkt GraphQL response is missing data');
      }

      return response.data;
    } catch (error) {
      lastError = error;
      const retryDelayMs = getRetryDelayMs(error, attempt);

      if (!isDefined(retryDelayMs) || attempt === OBJKT_MAX_RETRIES) {
        if (!isTimeoutError(error)) {
          logger.error('Objkt GraphQL request failed', error);
        }

        throw error;
      }

      logger.warn(`Objkt GraphQL request failed, retrying in ${Math.ceil(retryDelayMs)}ms (attempt ${attempt + 1})`);
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
};

export const fetchAllObjktPages = async <T extends { id: number }>(
  since: Date | string,
  fetchPage: (params: ObjktPageParams) => Promise<T[]>
) => {
  const results: T[] = [];
  const timestamp = toObjktTimestamp(since);
  let lastId = 0;
  let limit = OBJKT_PAGE_SIZE;
  let minLimitAttempts = 0;

  while (true) {
    try {
      const page = await fetchPage({
        since: timestamp,
        lastId,
        limit
      });

      results.push(...page);
      minLimitAttempts = 0;

      if (page.length < limit) {
        return results;
      }

      lastId = page[page.length - 1].id;
    } catch (error) {
      if (!isTimeoutError(error)) {
        throw error;
      }

      if (limit > OBJKT_MIN_PAGE_SIZE) {
        const nextLimit = nextSmallerPageSize(limit);
        logger.warn(`Objkt request timed out with limit ${limit}, retrying with limit ${nextLimit}`);
        limit = nextLimit;
        continue;
      }

      if (minLimitAttempts >= OBJKT_MAX_RETRIES) {
        logger.error('Objkt GraphQL request failed', error);
        throw error;
      }

      const retryDelayMs = toRetryDelayMs(minLimitAttempts);
      minLimitAttempts += 1;
      logger.warn(
        `Objkt request timed out at minimum limit ${limit}, retrying in ${Math.ceil(
          retryDelayMs
        )}ms (attempt ${minLimitAttempts})`
      );
      await sleep(retryDelayMs);
    }
  }
};
