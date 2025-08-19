import { Router } from 'express';

import { EnvVars } from '../config';

export const addTempleAdsRedirection = (
  router: Router,
  path: string,
  isMisesVariable: boolean,
  templeAdsPathMainPart = path
) => {
  router.get(path, (req, res) => {
    const { extVersion: rawExtVersion, isMisesBrowser: rawIsMisesBrowser } = req.query;
    const extVersion = typeof rawExtVersion === 'string' ? rawExtVersion : '0.0.0';
    const isMisesBrowser = rawIsMisesBrowser === 'true';
    res
      .header('Cache-Control', 'public, max-age=300')
      .redirect(
        `${EnvVars.TEMPLE_ADS_API_URL}/v1/api/ads-rules/${extVersion}${templeAdsPathMainPart}${
          isMisesVariable ? (isMisesBrowser ? '/mises' : '/no-mises') : ''
        }`
      );
  });
};
