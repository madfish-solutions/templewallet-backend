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

const getTotalSupplyPrice = async(dAppData, exchangeableTokensWithPrices) => {
  const token = dAppData.tokens && dAppData.tokens[0];
  if (!token) {
    return new BigNumber(0);
  }
  const exchangeableToken = exchangeableTokensWithPrices.find(
    ({ contract, token_id }) =>
    contract === token.contract && token_id === token.token_id
  );
  const tokenPrice = exchangeableToken ?
    exchangeableToken.price :
    new BigNumber(0);
  const tvl = new BigNumber(token.supply)
    .div(new BigNumber(10).pow(token.decimals))
    .multipliedBy(tokenPrice);
  return tvl;
};

const noValueLockedProjects = ["trianon", "equisafe"];
const getDAppStats = async(dAppData, exchangeableTokensWithPrices) => {
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
        await getTotalSupplyPrice(dAppData, exchangeableTokensWithPrices)
      ).plus(ovenMutezLocked.div(1e6));
      return { allDAppsTvlSummand: kolibriTvl, tvl: kolibriTvl };
    case slug === "stakerdao":
      const exchangeableToken = exchangeableTokensWithPrices.find(
        ({ contract }) => contract === contracts[0].address
      );
      if (!exchangeableToken) {
        return { allDAppsTvlSummand: new BigNumber(0), tvl: new BigNumber(0) };
      }
      const storage = await getStorage(contracts[0].address);
      const totalSupply = storage[6];
      const stakerdaoTvl = totalSupply.times(exchangeableToken.price);
      return { allDAppsTvlSummand: new BigNumber(0), tvl: stakerdaoTvl };
    case categories.includes("Token"):
      const tvl = await getTotalSupplyPrice(
        dAppData,
        exchangeableTokensWithPrices
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
          /* if (slug === "hen") {
            const hDAOAddress = "KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW";
            const hDAOExchangeableToken = exchangeableTokensWithPrices.find(
              ({ contract: candidateContract, token_id: candidateTokenId }) =>
              candidateContract === hDAOAddress && candidateTokenId === 0
            );
            if (hDAOExchangeableToken) {
              const hDAOBalance = await getBalance(
                address,
                "KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW",
                0
              );
              dAppTvlSummand = dAppTvlSummand.plus(
                hDAOBalance.div(1e6).multipliedBy(hDAOExchangeableToken.price)
              );
            }
          } else { */
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
                  async({ contract, token_id, decimals, price, symbol }) => {
                    const rawBalance = await getBalance(
                      address,
                      contract,
                      token_id
                    );
                    if (rawBalance.gt(0)) {
                      console.log(
                        slug,
                        address,
                        symbol,
                        contract,
                        token_id,
                        rawBalance.toString(),
                        decimals,
                        price.toString()
                      );
                    }
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
            // }
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

let dAppsSubscriptionsReady = false;
const getDAppsStats = async() => {
  logger.info("Getting dApps list...");
  const dApps = await getDApps();
  const dAppsWithDetails = await Promise.all(
    dApps.map(async(dApp) => {
      const { slug } = dApp;
      if (!dAppsSubscriptionsReady) {
        detailedDAppDataProvider.subscribe(slug);
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
  const {
    data: dexterDAppData,
    error: dexterDAppError,
  } = await detailedDAppDataProvider.get("dexter");
  if (dexterDAppError) {
    throw dexterDAppError;
  }
  const dexterExchangeableTokens = dexterDAppData.dex_tokens.filter(
    ({ network }) => network === "mainnet"
  );
  const {
    data: quipuswapExchangers,
    error: quipuswapExchangersError,
  } = await quipuswapExchangersDataProvider.getState();
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
    if (!uniqueTokens.find(
        ({ token_id, contract }) =>
        contract === token.contract && token_id === token.token_id
      )) {
      uniqueTokens.push(token);
    }
    return uniqueTokens;
  }, []);

  logger.info("Getting exchangeable tokens prices...");
  const exchangeableTokensWithPrices = await Promise.all(
    exchangeableTokens.map(async(token) => {
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
      const stats = await getDAppStats(dapp, exchangeableTokensWithPrices);
      logger.info(dapp.slug);
      return stats;
    })
  );
  logger.info("Aggregating results...");

  return {
    dApps: dApps
      .map((dApp, index) => ({
        ...dApp,
        tvl: dAppsStats[index].tvl.decimalPlaces(6).toFixed(),
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
  };
};

module.exports = getDAppsStats;