import BigNumber from "bignumber.js";
import memoizee from "memoizee";
import {
  BcdTokenData,
  contractTokensProvider,
  tokensMetadataProvider,
} from "./better-call-dev";
import fetch from "./fetch";
import { getTokenMetadata, getStorage, tezExchangeRateProvider } from "./tezos";
import SingleQueryDataProvider from "./SingleQueryDataProvider";
// import tzwrapEthTokensProvider from "./tzwrapEthTokensProvider";
import logger from "./logger";
import WebSocket from "ws";

const poolsUrl = process.env.POOLS_URL!;

import { BlockResponse, BlockFullHeader } from "@taquito/rpc";
import MutexProtectedData from "./MutexProtectedData";

interface BlockInterface
  extends Pick<BlockResponse, "protocol" | "chain_id" | "hash"> {
  header: Pick<BlockFullHeader, "level" | "timestamp">;
}

export enum RawDexType {
  QuipuSwap = "QuipuSwap",
  QuipuSwapTokenToTokenDex = "QuipuSwapTokenToTokenDex",
  Plenty = "Plenty",
  LiquidityBaking = "LiquidityBaking",
}

export enum RawDexTokenStandard {
  FA1_2 = "FA1_2",
  FA2 = "FA2",
}

export interface RawDexPool {
  dexType: RawDexType;
  dexAddress: string;
  dexId?: string;
  aTokenSlug: string;
  bTokenSlug: string;
  aTokenStandard?: RawDexTokenStandard;
  aTokenPool: string;
  bTokenPool: string;
  bTokenStandard?: RawDexTokenStandard;
}

export interface RawDexPoolsResponse {
  block: BlockInterface;
  routePairs: RawDexPool[];
}

type QuipuswapExchanger = {
  exchangerAddress: string;
  tokenAddress: string;
  tokenId?: number;
  tokenMetadata: BcdTokenData | undefined;
};

let poolsWs: WebSocket | undefined;
const relevantRawPoolsStorage = new MutexProtectedData<
  RawDexPool[] | undefined
>(undefined);

const getRelevantRawPools = async () => {
  let rawPools = await relevantRawPoolsStorage.getData();
  if (!rawPools) {
    logger.warn("Waiting for pools data to arrive...");
    await new Promise<void>((res) => {
      const interval = setInterval(async () => {
        rawPools = await relevantRawPoolsStorage.getData();
        if (rawPools) {
          clearInterval(interval);
          res();
        }
      }, 1000);
    });
    logger.info("Received pools data");
  }

  return rawPools!;
};

const initializePoolWs = () => {
  poolsWs = new WebSocket(poolsUrl);

  poolsWs.onerror = (e: WebSocket.ErrorEvent) => {
    logger.error(e.message);
    initializePoolWs();
  };

  poolsWs.onclose = () => {
    logger.error(`Web socket ${poolsUrl} was closed`);
    initializePoolWs();
  };

  poolsWs.onopen = () => {
    logger.info(`Web socket ${poolsUrl} was opened`);
  };

  poolsWs.onmessage = (event: WebSocket.MessageEvent) => {
    const data: RawDexPoolsResponse = JSON.parse(event.data.toString());

    relevantRawPoolsStorage.setData(
      data.routePairs.filter(({ dexType }) => dexType === RawDexType.QuipuSwap)
    );
  };
};

initializePoolWs();

const getQuipuswapExchangers = async () => {
  const rawPools = await getRelevantRawPools();

  return Promise.all(
    rawPools!.map(async ({ bTokenSlug, dexAddress, bTokenStandard }) => {
      const [tokenAddress, rawTokenId] = bTokenSlug.split("_");
      const tokenId =
        rawTokenId && bTokenStandard === RawDexTokenStandard.FA2
          ? +rawTokenId
          : undefined;
      await contractTokensProvider.subscribe("mainnet", tokenAddress, tokenId);
      const { data: tokensMetadata, error } = await contractTokensProvider.get(
        "mainnet",
        tokenAddress,
        tokenId
      );
      if (error) {
        logger.error(error);
      }

      return {
        exchangerAddress: dexAddress,
        tokenAddress,
        tokenId,
        tokenMetadata: tokensMetadata?.[0],
      };
    })
  );
};

export const quipuswapExchangersDataProvider = new SingleQueryDataProvider(
  30 * 1000,
  getQuipuswapExchangers
);

const LIQUIDITY_INTERVAL = 120000;
const getPoolTokenExchangeRate = memoizee(
  async ({
    contract: tokenAddress,
    decimals,
    token_id,
  }: {
    decimals?: number;
    token_id?: number;
    contract: string;
  }) => {
    if (decimals === undefined) {
      try {
        await tokensMetadataProvider.subscribe(
          "mainnet",
          tokenAddress,
          token_id
        );
        const { data: metadata } = await tokensMetadataProvider.get(
          "mainnet",
          tokenAddress,
          token_id
        );
        if (!metadata || metadata.length === 0) {
          decimals = (await getTokenMetadata(tokenAddress, token_id)).decimals;
        } else {
          decimals = metadata[0].decimals;
        }
      } catch (e) {
        decimals = 0;
      }
    }

    const { data: tezExchangeRate, error: tezExchangeRateError } =
      await tezExchangeRateProvider.getState();
    const { data: quipuswapExchangers, error: quipuswapExchangersError } =
      await quipuswapExchangersDataProvider.getState();
    if (quipuswapExchangersError || tezExchangeRateError) {
      throw quipuswapExchangersError || tezExchangeRateError;
    }
    let quipuswapExchangeRate = new BigNumber(0);
    let quipuswapWeight = new BigNumber(0);
    const tokenElementaryParts = new BigNumber(10).pow(decimals);
    const matchingQuipuswapExchangers = quipuswapExchangers!.filter(
      ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
        tokenAddress === swappableTokenAddress &&
        (swappableTokenId === undefined || swappableTokenId === token_id)
    );
    const relevantRawPools = await getRelevantRawPools();
    if (matchingQuipuswapExchangers.length > 0) {
      const exchangersCharacteristics = matchingQuipuswapExchangers.map(
        ({ exchangerAddress }) => {
          const { aTokenPool, bTokenPool } = relevantRawPools.find(
            ({ dexAddress: candidateExchangerAddress }) =>
              candidateExchangerAddress === exchangerAddress
          )!;
          const tezPool = new BigNumber(aTokenPool);
          const tokenPool = new BigNumber(bTokenPool);
          if (!tezPool.eq(0) && !tokenPool.eq(0)) {
            return {
              weight: tezPool,
              exchangeRate: tezPool
                .div(1e6)
                .div(tokenPool.div(tokenElementaryParts)),
            };
          }
          return { weight: new BigNumber(0), exchangeRate: new BigNumber(0) };
        }
      );
      quipuswapWeight = exchangersCharacteristics.reduce(
        (sum, { weight }) => sum.plus(weight),
        new BigNumber(0)
      );
      if (!quipuswapWeight.eq(0)) {
        quipuswapExchangeRate = exchangersCharacteristics
          .reduce(
            (sum, { weight, exchangeRate }) =>
              sum.plus(weight.multipliedBy(exchangeRate)),
            new BigNumber(0)
          )
          .div(quipuswapWeight);
      }
    }

    return quipuswapExchangeRate.times(tezExchangeRate!);
  },
  { promise: true, maxAge: LIQUIDITY_INTERVAL }
);

export type TokenExchangeRateEntry = {
  tokenAddress: string;
  tokenId?: number;
  exchangeRate: BigNumber;
  metadata: BcdTokenData;
};

export const ASPENCOIN_ADDRESS = "KT1S5iPRQ612wcNm6mXDqDhTNegGFcvTV7vM";
tokensMetadataProvider.subscribe("mainnet", ASPENCOIN_ADDRESS);

const getTokensExchangeRates = async (): Promise<TokenExchangeRateEntry[]> => {
  logger.info("Getting tokens exchange rates...");
  const { data: quipuswapExchangers, error: quipuswapError } =
    await quipuswapExchangersDataProvider.getState();
  if (quipuswapError) {
    throw quipuswapError;
  }
  logger.info("Getting tokens exchange rates from Quipuswap pools");
  let exchangeRates = await Promise.all(
    quipuswapExchangers!
      .reduce((onePerTokenExchangers, exchanger) => {
        if (
          !onePerTokenExchangers.some(
            ({ tokenAddress, tokenId }) =>
              exchanger.tokenAddress === tokenAddress &&
              exchanger.tokenId === tokenId
          )
        ) {
          onePerTokenExchangers.push(exchanger);
        }
        return onePerTokenExchangers;
      }, [] as QuipuswapExchanger[])
      .map(async ({ tokenAddress, tokenId, tokenMetadata }) => {
        logger.info(tokenMetadata?.name ?? tokenAddress);
        return {
          tokenAddress,
          tokenId,
          exchangeRate: await getPoolTokenExchangeRate({
            contract: tokenAddress,
            decimals: tokenMetadata && tokenMetadata.decimals,
            token_id: tokenId,
          }),
          metadata: tokenMetadata!,
        };
      })
  );

  if (
    !exchangeRates.some(
      ({ tokenAddress }) => tokenAddress === ASPENCOIN_ADDRESS
    )
  ) {
    logger.info("Getting exchange rate for Aspencoin");
    try {
      const { data: aspencoinMetadata, error: aspencoinMetadataError } =
        await tokensMetadataProvider.get("mainnet", ASPENCOIN_ADDRESS);
      if (aspencoinMetadataError) {
        throw aspencoinMetadataError;
      }
      const priceHistory = await fetch<any>(
        "https://gateway-web-markets.tzero.com/mdt/public-pricehistory/ASPD?page=1"
      );
      const latestValidEntry = priceHistory.priceHistories.find(
        ({ close }) => close !== null
      );
      const tokenPrice = latestValidEntry
        ? new BigNumber(latestValidEntry.close)
        : new BigNumber(0);

      exchangeRates.push({
        tokenAddress: ASPENCOIN_ADDRESS,
        tokenId: undefined,
        exchangeRate: tokenPrice,
        metadata: aspencoinMetadata![0],
      });
    } catch (e) {}
  }

  logger.info("Successfully got tokens exchange rates");
  return [...exchangeRates /*, ...tzwrapExchangeRates */].filter(
    ({ exchangeRate }) => !exchangeRate.eq(0)
  );
};

export const tokensExchangeRatesProvider = new SingleQueryDataProvider(
  13 * 60 * 1000,
  getTokensExchangeRates
);

export const getTotalSupplyPrice = async (
  token: Pick<BcdTokenData, "contract" | "token_id" | "supply" | "decimals">
) => {
  const { data: exchangeableTokensWithPrices, error } =
    await tokensExchangeRatesProvider.getState();
  if (error) {
    throw error;
  }
  const exchangeableToken = exchangeableTokensWithPrices!.find(
    ({ tokenAddress, tokenId }) =>
      tokenAddress === token.contract &&
      (tokenId === undefined || tokenId === token.token_id)
  );
  const tokenPrice = exchangeableToken
    ? exchangeableToken.exchangeRate
    : new BigNumber(0);
  let tokenSupply: BigNumber | number | string | undefined = token.supply;
  if (tokenSupply === undefined) {
    const storage = await getStorage(token.contract);
    tokenSupply = storage.total_supply || storage.totalSupply || 0;
  }
  const tvl = new BigNumber(tokenSupply!)
    .div(new BigNumber(10).pow(token.decimals))
    .multipliedBy(tokenPrice);
  return tvl;
};
