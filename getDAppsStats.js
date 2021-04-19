const BigNumber = require("bignumber.js");
const {
  getAccountTokenBalances,
  getDApps,
  detailedDAppDataProvider,
} = require("./utils/better-call-dev");
const { fetch } = require("./utils/fetch");
const logger = require("./utils/logger");
const {
  getBalance,
  tezExchangeRateProvider,
  getStorage,
} = require("./utils/tezos");
const {
  getTokenExchangeRate,
  quipuswapExchangersDataProvider,
} = require("./utils/tokens");

const getTotalSupplyPrice = async(dAppData, exchangableTokensWithPrices) => {
  const token = dAppData.tokens && dAppData.tokens[0];
  if (!token) {
    return new BigNumber(0);
  }
  const exchangableToken = exchangableTokensWithPrices.find(
    ({ contract, token_id }) =>
    contract === token.contract && token_id === token.token_id
  );
  const tokenPrice = exchangableToken ?
    exchangableToken.price :
    new BigNumber(0);
  const tvl = new BigNumber(token.supply)
    .div(new BigNumber(10).pow(token.decimals))
    .multipliedBy(tokenPrice);
  return tvl;
};

const noValueLockedProjects = ["trianon", "equisafe"];
const getDAppStats = async(dAppData, exchangableTokensWithPrices) => {
  const { slug, contracts, categories } = dAppData;
  const {
    data: tzExchangeRate,
    error: tzExchangeRateError,
  } = await tezExchangeRateProvider.getState();
  if (tzExchangeRateError) {
    throw tzExchangeRateError;
  }
  switch (true) {
    case slug === "quipuswap":
      const {
        data: quipuswapExchangers,
        error: quipuswapExchangersError,
      } = await quipuswapExchangersDataProvider.getState();
      if (quipuswapExchangersError) {
        throw quipuswapExchangersError;
      }
      const contractsMutezLocked = await Promise.all(
        quipuswapExchangers.map(async({ exchangerAddress }) => {
          const {
            storage: { tez_pool },
          } = await getStorage(exchangerAddress);
          return tez_pool;
        })
      );
      const totalTezLocked = contractsMutezLocked
        .reduce((sum, mutez) => sum.plus(mutez), new BigNumber(0))
        .div(1e6);
      return {
        allDAppsTvlSummand: totalTezLocked,
        tvl: totalTezLocked.multipliedBy(2),
      };
    case slug === "dexter":
      const dexterContractsMutezLocked = await Promise.all(
        contracts.map(async({ network, address }) => {
          if (network !== "mainnet") {
            return new BigNumber(0);
          }
          const { xtzPool } = await getStorage(address);
          return xtzPool;
        })
      );
      const dexterTotalTezLocked = dexterContractsMutezLocked
        .reduce((sum, mutez) => sum.plus(mutez), new BigNumber(0))
        .div(1e6);
      return {
        allDAppsTvlSummand: dexterTotalTezLocked,
        tvl: dexterTotalTezLocked.multipliedBy(2),
      };
    case slug === "tzbutton":
      const tzButtonTvl = (await getBalance(contracts[0].address)).div(1e6);
      return {
        allDAppsTvlSummand: tzButtonTvl,
        tvl: tzButtonTvl,
      };
    case slug === "tzcolors":
      const mutezBalance = await getBalance(
        "KT1CpeSQKdkhWi4pinYcseCFKmDhs5M74BkU"
      );
      const auctionStorage = await getStorage(
        "KT1CpeSQKdkhWi4pinYcseCFKmDhs5M74BkU"
      );
      const bigmapId = auctionStorage.toString();
      const bidsCounters = await fetch(
        "https://tzcolors-indexer.prod.gke.papers.tech/api/v1/auction/operations\
/count?entrypoint=bid&groupBy=storage_diff.children.0.name"
      );
      const bigmapContents = await fetch(
        "https://tezos-mainnet-conseil.prod.gke.papers.tech/v2/data/tezos/mainnet/\
big_map_contents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: "airgap00391",
          },
          body: JSON.stringify({
            fields: [
              "key",
              "key_hash",
              "operation_group_id",
              "big_map_id",
              "value",
            ],
            predicates: [{
                field: "big_map_id",
                operation: "eq",
                set: [bigmapId],
                inverse: false,
              },
              { field: "value", operation: "isnull", set: [""], inverse: true },
            ],
            orderBy: [{ field: "key", direction: "desc" }],
            aggregation: [],
            limit: 2000,
          }),
        }
      );
      const nowTimestamp = Date.now();
      const biddedActiveAuctions = bigmapContents.filter(
        ({ key, value }) =>
        bidsCounters[key] &&
        Number(
          value
          .slice(2, -2)
          .split(";")
          .map((value) => value.trim())[3]
        ) >=
        nowTimestamp / 1000
      );
      const tzcolorsTvl = mutezBalance
        .plus(
          biddedActiveAuctions.reduce(
            (sum, { value }) =>
            sum.plus(
              value
              .slice(2, -2)
              .split(";")
              .map((value) => value.trim())[5]
            ),
            new BigNumber(0)
          )
        )
        .div(1e6);
      return {
        allDAppsTvlSummand: tzcolorsTvl,
        tvl: tzcolorsTvl,
      };
    case noValueLockedProjects.includes(slug):
      return { allDAppsTvlSummand: new BigNumber(0), tvl: new BigNumber(0) };
    case slug === "aspencoin":
      const priceHistory = await fetch(
        "https://gateway-web-markets.tzero.com/mdt/public-pricehistory/ASPD?page=1"
      );
      const latestValidEntry = priceHistory.priceHistories.find(
        ({ close }) => close !== null
      );
      const tokenPrice = latestValidEntry ?
        new BigNumber(latestValidEntry.close) :
        new BigNumber(0);
      const aspenTvl = tokenPrice
        .multipliedBy(dAppData.tokens[0].supply)
        .div(tzExchangeRate);
      return { allDAppsTvlSummand: aspenTvl, tvl: aspenTvl };
    case slug === "kolibri":
      const { allOvenData } = await fetch(
        "https://kolibri-data.s3.amazonaws.com/mainnet/oven-data.json"
      );
      const ovenMutezLocked = allOvenData.reduce(
        (sumPart, { ovenData: { balance: balanceStr, isLiquidated } }) => {
          if (balanceStr === "0" || isLiquidated) {
            return sumPart;
          }
          return sumPart.plus(balanceStr);
        },
        new BigNumber(0)
      );
      const kolibriTvl = (
        await getTotalSupplyPrice(dAppData, exchangableTokensWithPrices)
      ).plus(ovenMutezLocked.div(1e6));
      return { allDAppsTvlSummand: kolibriTvl, tvl: kolibriTvl };
    case categories.includes("Token"):
      const tvl = await getTotalSupplyPrice(
        dAppData,
        exchangableTokensWithPrices
      );
      return { allDAppsTvlSummand: tvl, tvl };
    default:
      if (!contracts) {
        return { allDAppsTvlSummand: new BigNumber(0), tvl: new BigNumber(0) };
      }
      const contractsStats = await Promise.all(
        contracts.map(async({ address, network }) => {
          if (network !== "mainnet") {
            return {
              allDAppsTvlSummand: new BigNumber(0),
              dAppTvlSummand: new BigNumber(0),
            };
          }
          const mutezBalance = await getBalance(address);
          const allDAppsTvlSummand = mutezBalance.div(1e6);
          let dAppTvlSummand = allDAppsTvlSummand;
          let outOfTokens = false;
          let offset = 0;
          while (!outOfTokens) {
            const { balances } = await getAccountTokenBalances({
              address,
              network,
              offset,
            });
            offset += balances.length;
            balances.forEach(({ contract, token_id, decimals, balance }) => {
              const exchangableToken = exchangableTokensWithPrices.find(
                ({ contract: candidateContract, token_id: candidateTokenId }) =>
                candidateContract === contract &&
                candidateTokenId === token_id
              );
              if (!exchangableToken) {
                return;
              }
              dAppTvlSummand = dAppTvlSummand.plus(
                new BigNumber(balance)
                .div(new BigNumber(10).pow(decimals))
                .multipliedBy(exchangableToken.price)
              );
            });
            outOfTokens = balances.length === 0;
          }
          return {
            allDAppsTvlSummand,
            dAppTvlSummand,
          };
        })
      );
      const result = contractsStats.reduce(
        (acc, stats) => ({
          allDAppsTvlSummand: acc.allDAppsTvlSummand.plus(
            stats.allDAppsTvlSummand
          ),
          tvl: acc.tvl.plus(stats.dAppTvlSummand),
        }), { allDAppsTvlSummand: new BigNumber(0), tvl: new BigNumber(0) }
      );
      return result;
  }
};

const noDetailedDataRequiredDApps = ["quipuswap", "trianon", "tzcolors"];
const dAppsDetailsSubscriptionsSlugs = [
  "dexter",
  "tzbtc",
  "kolibri",
  "usdtz",
  "ethtz",
  "stakerdao",
  "aspencoin",
];

let dAppsSubscriptionsReady = false;
const getDAppsStats = async() => {
  logger.info("Getting dApps list...");
  const dApps = await getDApps();
  const dAppsWithDetails = await Promise.all(
    dApps.map(async(dApp) => {
      const { slug } = dApp;
      if (!dAppsSubscriptionsReady &&
        dAppsDetailsSubscriptionsSlugs.includes(slug)
      ) {
        detailedDAppDataProvider.subscribe(slug);
      }
      if (noDetailedDataRequiredDApps.includes(slug)) {
        return dApp;
      }
      const { data, error } = await detailedDAppDataProvider.get(slug);
      if (error) {
        throw error;
      }
      return data;
    })
  );

  logger.info("Getting exchangable tokens and their prices...");
  const {
    data: dexterDAppData,
    error: dexterDAppError,
  } = await detailedDAppDataProvider.get("dexter");
  if (dexterDAppError) {
    throw dexterDAppError;
  }
  const dexterExchangableTokens = dexterDAppData.dex_tokens.filter(
    ({ network }) => network === "mainnet"
  );
  const {
    data: quipuswapExchangers,
    error: quipuswapExchangersError,
  } = await quipuswapExchangersDataProvider.getState();
  if (quipuswapExchangersError) {
    throw quipuswapExchangersError;
  }
  const exchangableTokens = [
    ...dexterExchangableTokens,
    ...quipuswapExchangers
    .map(
      ({ tokenMetadata, tokenId, tokenAddress }) =>
      tokenMetadata || {
        token_id: tokenId || 0,
        contract: tokenAddress,
        symbol: tokenAddress,
        decimals: 0,
      }
    )
    .filter(
      ({ contract: candidateContract, token_id: candidateTokenId }) =>
      !dexterExchangableTokens.some(
        ({ contract, token_id }) =>
        contract === candidateContract && token_id === candidateTokenId
      )
    ),
  ];
  const exchangableTokensWithPrices = await Promise.all(
    exchangableTokens.map(async(token) => {
      const price = await getTokenExchangeRate(token);
      logger.info(token.symbol);
      return {
        ...token,
        price,
      };
    })
  );

  logger.info("Getting TVL stats...");
  const dAppsStats = await Promise.all(
    dAppsWithDetails.map(async(dapp) => {
      const stats = await getDAppStats(dapp, exchangableTokensWithPrices);
      logger.info(dapp.slug);
      return stats;
    })
  );
  logger.info("Aggregating results...");

  return {
    dApps: dApps.map((dApp, index) => ({
      ...dApp,
      tvl: dAppsStats[index].tvl.decimalPlaces(6).toFixed(),
    })),
    tvl: dAppsStats
      .reduce(
        (sum, { allDAppsTvlSummand }) => sum.plus(allDAppsTvlSummand),
        new BigNumber(0)
      )
      .decimalPlaces(6)
      .toFixed(),
  };
};

module.exports = getDAppsStats;