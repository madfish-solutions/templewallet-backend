import { Request, Response } from 'express';

import SingleQueryDataProvider from './SingleQueryDataProvider';

const getProviderStateWithTimeout = <T>(provider: SingleQueryDataProvider<T>) =>
  Promise.race([
    provider.getState(),
    new Promise<{ data?: undefined; error: Error }>(resolve =>
      setTimeout(() => resolve({ error: new Error('Response timed out') }), 30000)
    )
  ]);

export const makeProviderDataRequestHandler = <T, U>(
  provider: SingleQueryDataProvider<T>,
  transformFn?: (data: T) => U | Promise<U>,
  cacheControl = 'public, max-age=60'
) => {
  return async (_req: Request, res: Response) => {
    const { data, error } = await getProviderStateWithTimeout(provider);
    if (error) {
      res.status(500).send({ error: error.message });
    } else {
      try {
        res
          .status(200)
          .header('Cache-Control', cacheControl)
          .json(transformFn ? await transformFn(data) : data);
      } catch (error) {
        res.status(500).send({ error: (error as any)?.message ?? 'Internal server error' });
      }
    }
  };
};
