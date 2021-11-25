import BigNumber from "bignumber.js";
import tzwrapEthTokensProvider from "./utils/tzwrapEthTokensProvider";
import {
  DAppDetails,
  getAccountTokenBalances,
  getDApps,
  detailedDAppDataProvider,
  tokensMetadataProvider,
} from "./utils/better-call-dev";
import fetch from "./utils/fetch";
import logger from "./utils/logger";
import { getBalance, tezExchangeRateProvider, getStorage } from "./utils/tezos";
import {
  tokensExchangeRatesProvider,
  getTotalSupplyPrice,
  quipuswapExchangersDataProvider,
  TokenExchangeRateEntry,
} from "./utils/tokens";

type TzbuttonBigMapContents = {
  key_hash: string;
  operation_group_id: string;
  big_map_id: number;
  key: string;
  value: string;
}[];

type KolibriOvenData = {
  ovenAddress: string;
  ovenOwner: string;
  baker: string | null;
  balance: string;
  borrowedTokens: string;
  stabilityFee: string;
  isLiquidated: boolean;
  outstandingTokens: string;
};

type KolibriOvensData = {
  allOvenData: KolibriOvenData[];
};

const getTotalTokensPrice = async (
  contractAddress: string,
  tokensExchangeRates: TokenExchangeRateEntry[],
  showDeltas?: boolean
) => {
  let result = new BigNumber(0);
  let outOfTokens = false;
  let offset = 0;
  while (!outOfTokens) {
    const { balances, total } = await getAccountTokenBalances({
      address: contractAddress,
      network: "mainnet",
      offset,
    });
    offset += balances.length;
    if (total > tokensExchangeRates.length) {
      await Promise.all(
        tokensExchangeRates.map(
          async ({ tokenAddress, tokenId, exchangeRate, metadata }) => {
            const rawBalance = await getBalance(
              contractAddress,
              tokenAddress,
              tokenId
            );
            const delta = new BigNumber(rawBalance)
              .div(new BigNumber(10).pow(metadata?.decimals ?? 0))
              .multipliedBy(exchangeRate);
            if (delta.gt(0) && showDeltas) {
              console.log(tokenAddress, tokenId, delta.toString());
            }
            result = result.plus(delta);
          }
        )
      );
      outOfTokens = true;
    } else {
      balances.forEach(({ contract, token_id, balance, decimals }) => {
        const exchangeableToken = tokensExchangeRates.find(
          ({ tokenAddress: candidateContract, tokenId: candidateTokenId }) =>
            candidateContract === contract &&
            new BigNumber(candidateTokenId ?? 0).eq(token_id)
        );
        if (exchangeableToken) {
          const delta = new BigNumber(balance)
            .div(new BigNumber(10).pow(decimals))
            .multipliedBy(exchangeableToken.exchangeRate);
          if (delta.gt(0) && showDeltas) {
            console.log(contract, token_id, delta.toString());
          }
          result = result.plus(delta);
        }
      });
      outOfTokens = balances.length === 0;
    }
  }
  return result;
};

const bcdToLlamaSlugs = {
  youves: "youves",
  crunchy: "crunchy-network",
  aliensfarm: "aliensfarm",
};

const blacklistedProjects = ["trianon"];

const noValueLockedProjects = ["trianon", "equisafe", "kalamint"];
const getDAppStats = async (dAppData: DAppDetails) => {
  const { slug, contracts, categories, soon: comingSoon } = dAppData;
  const { data: tzExchangeRate, error: tzExchangeRateError } =
    await tezExchangeRateProvider.getState();
  const { data: tokensExchangeRates, error: tokensExchangeRatesError } =
    await tokensExchangeRatesProvider.getState();
  if (tzExchangeRateError || tokensExchangeRatesError) {
    throw tzExchangeRateError;
  }
  switch (true) {
    case bcdToLlamaSlugs[slug]:
      const llamaTvl = await fetch<number>(
        `https://api.llama.fi/tvl/${bcdToLlamaSlugs[slug]}`
      );
      return {
        allDAppsTvlSummand: new BigNumber(llamaTvl),
        totalTezLocked: new BigNumber(0),
        tvl: new BigNumber(llamaTvl),
      };
    case slug === "quipuswap":
      const { data: quipuswapExchangers, error: quipuswapExchangersError } =
        await quipuswapExchangersDataProvider.getState();
      if (quipuswapExchangersError) {
        throw quipuswapExchangersError;
      }
      const contractsMutezLocked = await Promise.all(
        quipuswapExchangers!.map(
          async ({ exchangerAddress }): Promise<BigNumber> => {
            const {
              storage: { tez_pool },
            } = await getStorage(exchangerAddress);
            return tez_pool;
          }
        )
      );
      const totalTezLocked = contractsMutezLocked
        .reduce((sum, mutez) => sum.plus(mutez), new BigNumber(0))
        .div(1e6);
      const allDAppsTvlSummand = totalTezLocked.times(tzExchangeRate!);
      return {
        allDAppsTvlSummand,
        totalTezLocked,
        tvl: allDAppsTvlSummand.times(2),
      };
    case slug === "dexter":
      const dexterContractsMutezLocked = await Promise.all(
        contracts!.map(async ({ network, address }): Promise<BigNumber> => {
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
      const dexterAllDAppsTvlSummand = dexterTotalTezLocked.times(
        tzExchangeRate!
      );
      return {
        allDAppsTvlSummand: dexterAllDAppsTvlSummand,
        totalTezLocked: dexterTotalTezLocked,
        tvl: dexterAllDAppsTvlSummand.multipliedBy(2),
      };
    case slug === "tzbutton":
      const tzButtonTezLocked = (await getBalance(contracts![0].address)).div(
        1e6
      );
      const tzButtonTvl = tzButtonTezLocked.times(tzExchangeRate!);
      return {
        allDAppsTvlSummand: tzButtonTvl,
        totalTezLocked: tzButtonTezLocked,
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
      const bidsCounters = await fetch<Record<string, number>>(
        "https://tzcolors-indexer.prod.gke.papers.tech/api/v1/auction/operations\
/count?entrypoint=bid&groupBy=storage_diff.children.0.name"
      );
      const bigmapContents = await fetch<TzbuttonBigMapContents>(
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
        .div(1e6)
        .times(tzExchangeRate!);
      return {
        allDAppsTvlSummand: tzcolorsTvl,
        totalTezLocked: mutezBalance.div(1e6),
        tvl: tzcolorsTvl,
      };
    case slug === "plenty":
      const { success, body: amount } = await fetch<{
        success: boolean;
        body?: number;
      }>("https://w0sujgfj39.execute-api.us-east-2.amazonaws.com/v1/tvl");
      if (!success) {
        throw new Error("Request to entrypoint for TVL failed");
      }
      const plentyTvl = new BigNumber(amount!);
      return {
        allDAppsTvlSummand: plentyTvl,
        totalTezLocked: plentyTvl.div(2),
        tvl: plentyTvl,
      };
    case noValueLockedProjects.includes(slug) || comingSoon:
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: new BigNumber(0),
      };
    case slug === "kolibri":
      const { allOvenData } = await fetch<KolibriOvensData>(
        "https://kolibri-data.s3.amazonaws.com/mainnet/oven-data.json"
      );
      const ovenMutezLocked = allOvenData.reduce(
        (sumPart, { balance: balanceStr, isLiquidated }) => {
          if (balanceStr === "0" || isLiquidated) {
            return sumPart;
          }
          return sumPart.plus(balanceStr);
        },
        new BigNumber(0)
      );
      const kolibriTotalTezLocked = ovenMutezLocked.div(1e6);
      const kolibriTvl = (await getTotalSupplyPrice(dAppData.tokens![0])).plus(
        kolibriTotalTezLocked.times(tzExchangeRate!)
      );
      return {
        allDAppsTvlSummand: kolibriTvl,
        totalTezLocked: kolibriTotalTezLocked,
        tvl: kolibriTvl,
      };
    case slug === "tzwrap":
      const { data: ethTokens, error: ethTokensError } =
        await tzwrapEthTokensProvider.getState();
      if (ethTokensError) {
        throw ethTokensError;
      }
      const tzwrapEthTvl = ethTokens!.reduce(
        (sum, { price, decimals, supply }) =>
          sum.plus(
            new BigNumber(supply!)
              .div(new BigNumber(10).pow(decimals))
              .multipliedBy(price)
          ),
        new BigNumber(0)
      );
      const governanceToken = dAppData.tokens!.find(
        ({ symbol }) => symbol!.toLowerCase() === "wrap"
      );
      const governanceExchangeableToken = tokensExchangeRates!.find(
        ({ tokenAddress, tokenId }) =>
          tokenAddress === governanceToken!.contract &&
          new BigNumber(tokenId ?? 0).eq(governanceToken!.token_id)
      );
      const governanceTvl = governanceExchangeableToken
        ? new BigNumber(governanceToken!.supply!)
            .div(new BigNumber(10).pow(governanceToken!.decimals))
            .multipliedBy(governanceExchangeableToken.exchangeRate)
        : 0;
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: tzwrapEthTvl.plus(governanceTvl),
      };
    case slug === "werenode":
      // Total supply isn't provided by contract :(
      return {
        allDAppsTvlSummand: new BigNumber(0),
        totalTezLocked: new BigNumber(0),
        tvl: new BigNumber(0),
      };
    case slug === "bazaar":
      let bDAOToken = dAppData.tokens?.[0];
      if (!bDAOToken) {
        const contract = dAppData.contracts![0];
        const { data: tokensMetadata, error } =
          await tokensMetadataProvider.get("mainnet", contract.address);
        if (error) {
          throw error;
        }
        bDAOToken = tokensMetadata![0];
      }
      const bDAOTvl = await getTotalSupplyPrice(bDAOToken!);
      const lockedTokensPrice = await getTotalTokensPrice(
        "KT1E8Qzgx3C5AAE4iGuXvqSQjdd21LK2aXAk",
        tokensExchangeRates!,
        true
      );
      console.log(lockedTokensPrice.toString());

      return {
        allDAppsTvlSummand: bDAOTvl.plus(lockedTokensPrice),
        totalTezLocked: new BigNumber(0),
        tvl: bDAOTvl,
      };
    case categories.includes("Token"):
      let token = dAppData.tokens?.[0];
      if (!token) {
        const contract = dAppData.contracts![0];
        const { data: tokensMetadata, error } =
          await tokensMetadataProvider.get("mainnet", contract.address);
        if (error) {
          throw error;
        }
        token = tokensMetadata![0];
      }
      const tvl = await getTotalSupplyPrice(token!);
      return {
        allDAppsTvlSummand: tvl,
        totalTezLocked: new BigNumber(0),
        tvl,
      };
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
          let dAppTvlSummand = allDAppsTvlSummand.plus(
            await getTotalTokensPrice(address, tokensExchangeRates!)
          );
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
  const dApps = (await getDApps({})).filter(
    ({ slug }) => !blacklistedProjects.includes(slug)
  );
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
      return data!;
    })
  );
  dAppsSubscriptionsReady = true;

  logger.info("Getting TVL stats...");
  const dAppsStats = await Promise.all(
    dAppsWithDetails.map(async (dapp) => {
      let stats;
      try {
        stats = await getDAppStats(dapp);
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
        tvl: dAppsStats[index].tvl.decimalPlaces(2).toFixed(),
        errorOccurred: dAppsStats[index].errorOccurred,
      }))
      .sort(({ slug: aSlug }, { slug: bSlug }) => {
        const aEstimatedUsersPerMonth = dAppsWithDetails.find(
          ({ slug }) => slug === aSlug
        )!.estimatedUsersPerMonth;
        const bEstimatedUsersPerMonth = dAppsWithDetails.find(
          ({ slug }) => slug === bSlug
        )!.estimatedUsersPerMonth;
        return bEstimatedUsersPerMonth - aEstimatedUsersPerMonth;
      }),
    tvl: dAppsStats
      .reduce(
        (sum, { allDAppsTvlSummand }) => sum.plus(allDAppsTvlSummand),
        new BigNumber(0)
      )
      .decimalPlaces(2)
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

export default getDAppsStats;
