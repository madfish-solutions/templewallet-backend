const BigNumber = require("bignumber.js");
const tzwrapEthTokensProvider = require("./tzwrapEthTokensProvider");
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
  getTotalSupplyPrice,
  quipuswapExchangersDataProvider,
} = require("./utils/tokens");

const noValueLockedProjects = ["trianon", "equisafe"];
const getDAppStats = async (dAppData, exchangeableTokensWithPrices) => {
  const { slug, contracts, categories } = dAppData;
  const { data: tzExchangeRate, error: tzExchangeRateError } =
    await tezExchangeRateProvider.getState();
  if (tzExchangeRateError) {
    throw tzExchangeRateError;
  }
  switch (true) {
    case slug === "quipuswap":
      const { data: quipuswapExchangers, error: quipuswapExchangersError } =
        await quipuswapExchangersDataProvider.getState();
      if (quipuswapExchangersError) {
        throw quipuswapExchangersError;
      }
      const contractsMutezLocked = await Promise.all(
        quipuswapExchangers.map(async ({ exchangerAddress }) => {
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
        totalTezLocked,
        tvl: totalTezLocked.multipliedBy(2),
      };
    case slug === "dexter":
      const dexterContractsMutezLocked = await Promise.all(
        contracts.map(async ({ network, address }) => {
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
        totalTezLocked: dexterTotalTezLocked,
        tvl: dexterTotalTezLocked.multipliedBy(2),
      };
    case slug === "tzbutton":
      const tzButtonTvl = (await getBalance(contracts[0].address)).div(1e6);
      return {
        allDAppsTvlSummand: tzButtonTvl,
        totalTezLocked: tzButtonTvl,
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
big_map_contents",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apiKey: "airgap00391",
          },
          body: JSON.stringify({
            fields: [
              "key",
              "key_hash",
              "operation_group_id",
              "big_map_id",
              "value",
            ],
            predicates: [
              {
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
        totalTezLocked: mutezBalance.div(1e6),
        tvl: tzcolorsTvl,
      };
    case noValueLockedProjects.includes(slug):
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: new BigNumber(0),
      };
    case slug === "aspencoin":
      const priceHistory = await fetch(
        "https://gateway-web-markets.tzero.com/mdt/public-pricehistory/ASPD?page=1"
      );
      const latestValidEntry = priceHistory.priceHistories.find(
        ({ close }) => close !== null
      );
      const tokenPrice = latestValidEntry
        ? new BigNumber(latestValidEntry.close)
        : new BigNumber(0);
      const aspenTotalSupply = dAppData.tokens
        ? dAppData.tokens[0].supply
        : (await getStorage(contracts[0].address)).total_supply;
      const aspenTvl = tokenPrice
        .multipliedBy(aspenTotalSupply)
        .div(tzExchangeRate);
      return {
        allDAppsTvlSummand: aspenTvl,
        totalTezLocked: new BigNumber(0),
        tvl: aspenTvl,
      };
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
      const kolibriTotalTezLocked = ovenMutezLocked.div(1e6);
      const kolibriTvl = (
        await getTotalSupplyPrice(
          dAppData.tokens[0],
          exchangeableTokensWithPrices
        )
      ).plus(kolibriTotalTezLocked);
      return {
        allDAppsTvlSummand: kolibriTvl,
        totalTezLocked: kolibriTotalTezLocked,
        tvl: kolibriTvl,
      };
    case slug === "stakerdao":
      const exchangeableToken = exchangeableTokensWithPrices.find(
        ({ contract }) => contract === contracts[0].address
      );
      if (!exchangeableToken) {
        return {
          allDAppsTvlSummand: new BigNumber(0),
          totalTezLocked: new BigNumber(0),
          tvl: new BigNumber(0),
        };
      }
      const storage = await getStorage(contracts[0].address);
      const totalSupply = storage[6];
      const stakerdaoTvl = totalSupply.times(exchangeableToken.price);
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: stakerdaoTvl,
      };
    case slug === "tzwrap":
      const { data: ethTokens, error: ethTokensError } =
        await tzwrapEthTokensProvider.getState();
      if (ethTokensError) {
        throw ethTokensError;
      }
      const tzwrapEthTvl = ethTokens
        .reduce(
          (sum, { price, decimals, supply }) =>
            sum.plus(
              new BigNumber(supply)
                .div(new BigNumber(10).pow(decimals))
                .multipliedBy(price)
            ),
          new BigNumber(0)
        )
        .div(tzExchangeRate);
      const governanceToken = dAppData.tokens.find(
        ({ symbol }) => symbol.toLowerCase() === "wrap"
      );
      const governanceExchangeableToken = exchangeableTokensWithPrices.find(
        ({ contract, token_id }) =>
          contract === governanceToken.contract &&
          token_id === governanceToken.token_id
      );
      const governanceTvl = governanceExchangeableToken
        ? new BigNumber(governanceToken.supply)
            .div(new BigNumber(10).pow(governanceToken.decimals))
            .multipliedBy(governanceExchangeableToken.price)
        : 0;
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: tzwrapEthTvl.plus(governanceTvl),
      };
    case categories.includes("Token"):
      const tvl = await getTotalSupplyPrice(
        dAppData.tokens[0],
        exchangeableTokensWithPrices
      );
      return { allDAppsTvlSummand: tvl, totalTezLocked: new BigNumber(0), tvl };
    default:
      if (!contracts) {
        return {
          allDAppsTvlSummand: new BigNumber(0),
          totalTezLocked: new BigNumber(0),
          tvl: new BigNumber(0),
        };
      }
      const contractsStats = await Promise.all(
        contracts.map(async ({ address, network }) => {
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
            const { balances, total } = await getAccountTokenBalances({
              address,
              network,
              offset,
            });
            offset += balances.length;
            if (total > exchangeableTokensWithPrices.length) {
              await Promise.all(
                exchangeableTokensWithPrices.map(
                  async ({ contract, token_id, decimals, price, symbol }) => {
                    const rawBalance = await getBalance(
                      address,
                      contract,
                      token_id
                    );
                    dAppTvlSummand = dAppTvlSummand.plus(
                      new BigNumber(rawBalance)
                        .div(new BigNumber(10).pow(decimals))
                        .multipliedBy(price)
                    );
                  }
                )
              );
              outOfTokens = true;
            } else {
              balances.forEach(({ contract, token_id, decimals, balance }) => {
                const exchangeableToken = exchangeableTokensWithPrices.find(
                  ({
                    contract: candidateContract,
                    token_id: candidateTokenId,
                  }) =>
                    candidateContract === contract &&
                    candidateTokenId === token_id
                );
                if (exchangeableToken) {
                  dAppTvlSummand = dAppTvlSummand.plus(
                    new BigNumber(balance)
                      .div(new BigNumber(10).pow(decimals))
                      .multipliedBy(exchangeableToken.price)
                  );
                }
              });
              outOfTokens = balances.length === 0;
            }
          }
          return {
            allDAppsTvlSummand,
            dAppTvlSummand,
          };
        })
      );
      const sum = contractsStats.reduce(
        (acc, stats) => ({
          allDAppsTvlSummand: acc.allDAppsTvlSummand.plus(
            stats.allDAppsTvlSummand
          ),
          tvl: acc.tvl.plus(stats.dAppTvlSummand),
        }),
        { allDAppsTvlSummand: new BigNumber(0), tvl: new BigNumber(0) }
      );
      return {
        ...sum,
        totalTezLocked: new BigNumber(sum.allDAppsTvlSummand),
      };
  }
};

let dAppsSubscriptionsReady = false;
const getDAppsStats = async () => {
  logger.info("Getting dApps list...");
  const dApps = await getDApps();
  const dAppsWithDetails = await Promise.all(
    dApps.map(async (dApp) => {
      const { slug } = dApp;
      if (!dAppsSubscriptionsReady) {
        await detailedDAppDataProvider.subscribe(slug);
      }
      const { data, error } = await detailedDAppDataProvider.get(slug);
      if (error) {
        throw error;
      }
      return data;
    })
  );
  dAppsSubscriptionsReady = true;

  logger.info("Getting exchangeable tokens...");
  const { data: dexterDAppData, error: dexterDAppError } =
    await detailedDAppDataProvider.get("dexter");
  if (dexterDAppError) {
    throw dexterDAppError;
  }
  const dexterExchangeableTokens = dexterDAppData.dex_tokens.filter(
    ({ network }) => network === "mainnet"
  );
  const { data: quipuswapExchangers, error: quipuswapExchangersError } =
    await quipuswapExchangersDataProvider.getState();
  if (quipuswapExchangersError) {
    throw quipuswapExchangersError;
  }
  const exchangeableTokens = [
    ...quipuswapExchangers.map(
      ({ tokenMetadata, tokenId, tokenAddress }) =>
        tokenMetadata || {
          token_id: tokenId || 0,
          contract: tokenAddress,
          symbol: tokenAddress,
          decimals: 0,
        }
    ),
    ...dexterExchangeableTokens,
  ].reduce((uniqueTokens, token) => {
    if (
      !uniqueTokens.find(
        ({ token_id, contract }) =>
          contract === token.contract && token_id === token.token_id
      )
    ) {
      uniqueTokens.push(token);
    }
    return uniqueTokens;
  }, []);

  logger.info("Getting exchangeable tokens prices...");
  const exchangeableTokensWithPrices = await Promise.all(
    exchangeableTokens.map(async (token) => {
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
    dAppsWithDetails.map(async (dapp) => {
      let stats;
      try {
        stats = await getDAppStats(dapp, exchangeableTokensWithPrices);
      } catch (e) {
        logger.error(`${e.message}\n${e.stack}`);
        stats = {
          allDAppsTvlSummand: new BigNumber(0),
          totalTezLocked: new BigNumber(0),
          tvl: new BigNumber(0),
          errorOccurred: true,
        };
      }
      logger.info(dapp.slug);
      return stats;
    })
  );
  logger.info("All data was fetched");

  return {
    dApps: dApps
      .map((dApp, index) => ({
        ...dApp,
        tvl: dAppsStats[index].tvl.decimalPlaces(6).toFixed(),
        errorOccurred: dAppsStats[index].errorOccurred,
      }))
      .sort(({ slug: aSlug }, { slug: bSlug }) => {
        const aEstimatedUsersPerMonth = dAppsWithDetails.find(
          ({ slug }) => slug === aSlug
        ).estimatedUsersPerMonth;
        const bEstimatedUsersPerMonth = dAppsWithDetails.find(
          ({ slug }) => slug === bSlug
        ).estimatedUsersPerMonth;
        return bEstimatedUsersPerMonth - aEstimatedUsersPerMonth;
      }),
    tvl: dAppsStats
      .reduce(
        (sum, { allDAppsTvlSummand }) => sum.plus(allDAppsTvlSummand),
        new BigNumber(0)
      )
      .decimalPlaces(6)
      .toFixed(),
    totalTezLocked: dAppsStats
      .reduce(
        (sum, { totalTezLocked }) => sum.plus(totalTezLocked),
        new BigNumber(0)
      )
      .decimalPlaces(6)
      .toFixed(),
  };
};

module.exports = getDAppsStats;
