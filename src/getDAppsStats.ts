import { DAPPS_LIST, IOS_DAPPS_LIST } from './utils/dapp-list-constants';
import logger from './utils/logger';

const getDAppsStats = (forIOs: boolean) => {
  logger.info('Getting dApps list...');

  return {
    dApps: forIOs ? IOS_DAPPS_LIST : DAPPS_LIST
  };
};

export default getDAppsStats;
