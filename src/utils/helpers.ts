import { BigNumber } from 'bignumber.js';
import QueryString from 'qs';

/** From lodash */
type Truthy<T> = T extends null | undefined | false | '' | 0 | 0n ? never : T;

export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);

export function range(start: number, end: number, step = 1) {
  return Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => start + step * index);
}

export function rangeBn(start: number, end: number, step = 1): Array<BigNumber> {
  return Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => new BigNumber(start + step * index));
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const emptyFn = () => {};

export const assertPickQuery = <K extends string>(query: QueryString.ParsedQs, ...keys: K[]) => {
  for (const key of keys) {
    const value = query[key];
    if (typeof value !== 'string' || !value) throw new Error(`Query parameter \`${key}\` must be non-empty string`);
  }

  return query as { readonly [key in K]: string };
};
