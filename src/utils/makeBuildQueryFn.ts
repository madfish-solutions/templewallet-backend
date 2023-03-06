import axios, { AxiosRequestConfig } from 'axios';
import { stringify } from 'qs';

import logger from './logger';
import PromisifiedSemaphore from './PromisifiedSemaphore';

function pick<T extends Record<string, unknown> | object, U extends keyof T>(obj: T, keys: U[]) {
  const newObj: Partial<T> = {};
  keys.forEach(key => {
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

export default function makeBuildQueryFn<P extends Record<string, unknown> | object, R>(
  baseUrl: string,
  maxConcurrentQueries?: number,
  defaultConfig: Omit<AxiosRequestConfig, 'url'> = {}
) {
  const semaphore = maxConcurrentQueries !== undefined ? new PromisifiedSemaphore(maxConcurrentQueries) : undefined;

  return function f1<P1 extends P, R1 extends R>(
    path: string | ((params: P1) => string),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toQueryParams?: (keyof P1)[] | ((params: P1) => Record<string, any>),
    config?: Omit<AxiosRequestConfig, 'url'>
  ) {
    return async (params: P1) => {
      const url = typeof path === 'function' ? path(params) : path;
      const queryParams =
        typeof toQueryParams === 'function' ? toQueryParams(params) : toQueryParams ? pick(params, toQueryParams) : {};
      const queryStr = stringify(queryParams);
      const noQueryParamsUrl = isAbsoluteURL(url) ? `${url}/` : `${baseUrl}${url}`;
      const fullUrl = `${noQueryParamsUrl}${queryStr.length === 0 ? '' : `?${queryStr}`}`;
      const getData = async () => {
        try {
          const requestConfig = {
            url: fullUrl,
            ...defaultConfig,
            ...config
          };
          logger.debug(requestConfig);
          const { data } = await axios.request<R1>(requestConfig);

          return data;
        } catch (e) {
          logger.error(`Error while making query to ${fullUrl}`);
          throw e;
        }
      };

      if (semaphore) {
        return new Promise<R1>((resolve, reject) => {
          semaphore.exec(async () => {
            try {
              const data = await getData();
              resolve(data);
            } catch (e) {
              reject(e);
            }
          });
        });
      }

      return getData();
    };
  };
}
