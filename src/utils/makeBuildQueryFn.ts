import qs from "qs";
import fetch from "./fetch";
import PromisifiedSemaphore from "./PromisifiedSemaphore";

function pick<T, U extends keyof T>(obj: T, keys: U[]) {
  const newObj: Partial<T> = {};
  keys.forEach((key) => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj as Pick<T, U>;
}

export default function makeBuildQueryFn<P, R>(
  baseUrl: string,
  maxConcurrentQueries?: number
) {
  const semaphore = maxConcurrentQueries
    ? new PromisifiedSemaphore(maxConcurrentQueries)
    : undefined;
  return function f1<P1 extends P, R1 extends R>(
    path: string | ((params: P1) => string),
    toQueryParams?: (keyof P1)[] | ((params: P1) => Record<string, any>)
  ) {
    return async (params: P1) => {
      const url = typeof path === "function" ? path(params) : path;
      const queryParams =
        typeof toQueryParams === "function"
          ? toQueryParams(params)
          : toQueryParams
          ? pick(params, toQueryParams)
          : {};
      const queryStr = qs.stringify(queryParams);
      const fullUrl = `${baseUrl}${url}${
        queryStr.length === 0 ? "" : `?${queryStr}`
      }`;
      if (semaphore) {
        return new Promise<R1>((resolve, reject) => {
          semaphore.exec(async () => {
            try {
              const result = await fetch<R1>(fullUrl);
              resolve(result);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
      return fetch<R1>(fullUrl);
    };
  };
}
