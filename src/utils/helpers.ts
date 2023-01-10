export function range(start: number, end: number, step = 1) {
  return Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => start + step * index);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const emptyFn = () => {};
