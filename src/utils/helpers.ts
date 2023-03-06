import { BigNumber } from 'bignumber.js';

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

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(() => resolve('wake'), ms));
