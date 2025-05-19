import { DAPPS_LIST } from './utils/dapp-list-constants';
import logger from './utils/logger';

const getDAppsStats = () => {
  logger.info('Getting dApps list...');

  return {
    dApps: DAPPS_LIST
  };
};

export default getDAppsStats;
