import { Router } from 'express';
import memoizee from 'memoizee';

import { EnvVars } from '../config';

export const addTempleAdsRedirection = (
  router: Router,
  path: string,
  isMisesVariable: boolean,
  templeAdsPathMainPart = path
) => {
  const getRedirectionUrl = memoizee(
    (extVersion: string, isMisesBrowser: boolean) =>
      `${EnvVars.TEMPLE_ADS_API_URL}/v1/api/ads-rules/${extVersion}${templeAdsPathMainPart}${
        isMisesVariable ? (isMisesBrowser ? '/mises' : '/no-mises') : ''
      }`,
    { max: 1000, normalizer: args => JSON.stringify(args) }
  );

  router.get(path, (req, res) => {
    const { extVersion: rawExtVersion, isMisesBrowser: rawIsMisesBrowser } = req.query;
    const extVersion = typeof rawExtVersion === 'string' ? rawExtVersion : '0.0.0';
    const isMisesBrowser = rawIsMisesBrowser === 'true';
    res.redirect(getRedirectionUrl(extVersion, isMisesBrowser));
  });
};
