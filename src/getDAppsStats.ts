import { DAPPS_LIST } from './utils/dapp-list-constants';
import logger from './utils/logger';

const getDAppsStats = (platform?: string) => {
  logger.info('Getting dApps list...');

  return {
    dApps: DAPPS_LIST.flatMap(({ platforms, ...dapp }) =>
      !platforms || platforms.some(supportedPlatform => supportedPlatform === platform) ? [dapp] : []
    )
  };
};

export default getDAppsStats;
