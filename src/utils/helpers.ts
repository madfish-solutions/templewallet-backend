import { AxiosError } from 'axios';
import { inspect } from 'util';

import logger from './logger';

/** From lodash */
type Truthy<T> = T extends null | undefined | false | '' | 0 | 0n ? never : T;

type AwaitedTuple<T extends readonly unknown[] | []> = { -readonly [K in keyof T]: Awaited<T[K]> };

export const range = (start: number, end: number, step = 1) =>
  Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => start + step * index);

export const pick = <T extends object, U extends keyof T>(obj: T, keys: U[]) => {
  const newObj: Partial<T> = {};
  keys.forEach(key => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });

  return newObj as Pick<T, U>;
};

export const isAbsoluteURL = (url: string) => {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const emptyFn = () => {};

export const isDefined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;

export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);

export const isNonEmptyString = (str: unknown): str is string => typeof str === 'string' && str.length !== 0;

export const getExternalApiErrorPayload = (error: unknown) => {
  const response = error instanceof AxiosError ? error.response : undefined;
  const status = response?.status ?? 500;
  const data = response?.data ?? { error: error instanceof Error ? error.message : error };

  return { status, data };
};

export function safeCheck(check: () => boolean, def = false) {
  try {
    return check();
  } catch (error) {
    console.error();

    return def;
  }
}

/**
 * A fail-fast `Promise.all` that cannot abort the process. Plain `Promise.all` rejects on the first error and stops
 * observing inputs still in flight, so their later rejections arrive unhandled and terminate Node. Each input gets a
 * handler that propagates only the first failure (tracked with an internal `AbortController`); later sibling failures
 * are logged and swallowed so they never become unhandled.
 */
// The `| []` in the constraint is what makes TS infer a tuple rather than an array, as `Promise.all` itself declares
export const safePromiseAll = async <T extends readonly unknown[] | []>(values: T) => {
  const abortController = new AbortController();

  // Widened so that the settled results get a concrete element type, without which the cast below would not typecheck
  const inputs: readonly unknown[] = values;

  // The assertion restores the tuple shape, which is unavailable while `T` is still generic
  return (await Promise.all(
    inputs.map(value =>
      Promise.resolve(value).catch(reason => {
        logger.error(`Parallel job rejected: ${inspect(reason)}`);

        if (!abortController.signal.aborted) {
          abortController.abort();
          throw reason;
        }

        // Already aborted: keep this slot pending so a swallowed rejection cannot fulfill Promise.all with undefined
        return new Promise<never>(() => undefined);
      })
    )
  )) as AwaitedTuple<T>;
};

export function withErrorLogging<A extends unknown[], T>(fn: (...args: A) => Promise<T>, errorMsg: string) {
  return async function (...args: A) {
    try {
      return await fn(...args);
    } catch (e) {
      logger.error(errorMsg, e);

      throw e;
    }
  };
}
