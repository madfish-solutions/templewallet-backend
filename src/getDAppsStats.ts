import { dappList } from "./utils/dapp-list-constants";
import logger from "./utils/logger";

const getDAppsStats = async () => {
  logger.info("Getting dApps list...");
  
return {
    dApps: dappList
  };
};

export default getDAppsStats;
