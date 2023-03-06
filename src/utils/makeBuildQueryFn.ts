import axios, { AxiosRequestConfig } from 'axios';
import { stringify } from 'qs';

import { isAbsoluteURL, pick } from './helpers';
import logger from './logger';
import PromisifiedSemaphore from './PromisifiedSemaphore';

export default function makeBuildQueryFn<P extends object, R>(
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
