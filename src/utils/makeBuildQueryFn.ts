import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";

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

function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
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
    toQueryParams?: (keyof P1)[] | ((params: P1) => Record<string, any>),
    config?: Omit<AxiosRequestConfig, "url">
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
      const noQueryParamsUrl = isAbsoluteURL(url)
        ? `${url}/`
        : `${baseUrl}${url}`;
      const fullUrl = `${noQueryParamsUrl}${
        queryStr.length === 0 ? "" : `?${queryStr}`
      }`;
      if (semaphore) {
        return new Promise<R1>((resolve, reject) => {
          semaphore.exec(async () => {
            try {
              const { data } = await axios.request<R1>({
                url: fullUrl,
                ...config
              });
              resolve(data);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
      const { data } = await axios.request<R1>({ url: fullUrl, ...config });
      
return data;
    };
  };
}
