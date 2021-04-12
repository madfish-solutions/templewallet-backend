const { TezosToolkit } = require("@taquito/taquito");
const BigNumber = require("bignumber.js");
// const memoizee = require('memoizee');
const { fetch } = require("./utils/fetch");
const logger = require("./utils/logger");

const BCD_BASE_URL = "https://api.better-call.dev/v1";
const MAINNET_RPC_URL = "https://mainnet.smartpy.io";

const mainnetToolkit = new TezosToolkit(MAINNET_RPC_URL);

// const getContract = memoizee((address) => mainnetToolkit.contract.at(address));

const getDAppsStats = async() => {
  const dApps = await fetch(`${BCD_BASE_URL}/dapps`);
  const dAppsWithTvl = await Promise.all(
    dApps.map(async({ slug }) => {
      const detailedDApp = await fetch(`${BCD_BASE_URL}/dapps/${slug}`);
      // console.log(detailedDApp);
      const { contracts } = detailedDApp;
      if (!contracts) {
        return {
          ...detailedDApp,
          tvl: "0",
          tzLocked: "0",
        };
      }
      const balances = await Promise.all(
        contracts.map(async({ address, network }) => {
          if (network !== "mainnet") {
            return;
          }
          try {
            return await mainnetToolkit.rpc.getBalance(address);
          } catch (e) {
            logger.error(e);
          }
        })
      );
      return {
        ...detailedDApp,
        tvl: "0",
        tzLocked: balances
          .reduce((sum, balance) => sum.plus(balance), new BigNumber(0))
          .div(1e6)
          .toString(),
      };
    })
  );
  return {
    totalTzLocked: dAppsWithTvl
      .reduce((sum, { tzLocked }) => {
        console.log(sum.toString(), tzLocked);
        return sum.plus(tzLocked);
      }, new BigNumber(0))
      .toString(),
    dApps: dAppsWithTvl,
  };
};

module.exports = getDAppsStats;