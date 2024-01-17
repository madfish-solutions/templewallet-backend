import { AxiosError } from 'axios';
import { BigNumber } from 'bignumber.js';

export const range = (start: number, end: number, step = 1) =>
  Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => start + step * index);

export const rangeBn = (start: number, end: number, step = 1) =>
  Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => new BigNumber(start + step * index));

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

export const isNonEmptyString = (str: unknown): str is string => typeof str === 'string' && str.length !== 0;

export const sleep = (ms: number) => new Promise(resolve => setTimeout(() => resolve('wake'), ms));

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
