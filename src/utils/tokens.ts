import BigNumber from "bignumber.js";
import memoizee from "memoizee";
import {
  BcdTokenData,
  detailedDAppDataProvider,
  contractTokensProvider,
  tokensMetadataProvider,
} from "./better-call-dev";
import fetch from "./fetch";
import {
  getTokenDescriptor,
  getTokenMetadata,
  getStorage,
  tezExchangeRateProvider,
} from "./tezos";
import SingleQueryDataProvider from "./SingleQueryDataProvider";
import tzwrapEthTokensProvider from "./tzwrapEthTokensProvider";
import logger from "./logger";
import {
  networksQuipuswapFactories,
  poolsDataProvider,
  TokenXtzPoolData,
} from "./pools";

type QuipuswapExchanger = {
  exchangerAddress: string;
  tokenAddress: string;
  tokenId?: string;
  tokenMetadata: BcdTokenData | undefined;
  factoryAddress: string;
  tokenPool: BigNumber;
  tezPool: BigNumber;
};

const getQuipuswapExchangers = async (): Promise<QuipuswapExchanger[]> => {
  logger.info("Getting exchangers...");
  const { data: pools, error: poolsError } = await poolsDataProvider.get(
    "mainnet"
  );
  if (poolsError) {
    throw poolsError;
  }

  // TODO: add token to token exchangers
  const tokenToXtzPools = pools!.filter(
    (pool): pool is TokenXtzPoolData => pool.type === "tokenxtz"
  );

  logger.info("Getting tokens metadata for FA1.2 Quipuswap exchangers...");
  const fa12Exchangers = await Promise.all(
    tokenToXtzPools
      .filter(({ tokenA: { type: tokenType } }) => tokenType === "FA12")
      .map(
        async ({
          tokenA: { address: tokenAddress },
          address: exchangerAddress,
          factoryAddress,
          tokenAPool: tokenPool,
          tokenBPool: tezPool,
        }) => {
          await contractTokensProvider.subscribe("mainnet", tokenAddress);
          const { data: tokensMetadata, error } =
            await contractTokensProvider.get("mainnet", tokenAddress);
          if (error) {
            throw error;
          }

          return {
            tokenAddress,
            exchangerAddress,
            tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
            factoryAddress,
            tokenPool: new BigNumber(tokenPool),
            tezPool: new BigNumber(tezPool),
          };
        }
      )
  );

  logger.info("Getting tokens metadata for FA2 Quipuswap exchangers...");
  const fa2Exchangers = await Promise.all(
    tokenToXtzPools
      .filter(({ tokenA: { type: tokenType } }) => tokenType === "FA2")
      .map(
        async ({
          tokenA: { address: tokenAddress, id: tokenId },
          address: exchangerAddress,
          factoryAddress,
          tokenAPool: tokenPool,
          tokenBPool: tezPool,
        }) => {
          await contractTokensProvider.subscribe(
            "mainnet",
            tokenAddress,
            tokenId
          );
          const { data: tokensMetadata, error } =
            await contractTokensProvider.get("mainnet", tokenAddress, tokenId);
          if (error) {
            throw error;
          }

          return {
            exchangerAddress,
            tokenAddress,
            tokenId: tokenId!,
            tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
            factoryAddress,
            tokenPool: new BigNumber(tokenPool),
            tezPool: new BigNumber(tezPool),
          };
        }
      )
  );

  logger.info("Successfully got Quipuswap exchangers");
  return [...fa12Exchangers, ...fa2Exchangers];
};
export const quipuswapExchangersDataProvider = new SingleQueryDataProvider(
  14 * 60 * 1000,
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
    token_id?: string;
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
    const { data: dexterDAppData, error: dexterDAppError } =
      await detailedDAppDataProvider.get("dexter");
    const { data: quipuswapExchangers, error: quipuswapExchangersError } =
      await quipuswapExchangersDataProvider.getState();
    if (dexterDAppError || quipuswapExchangersError || tezExchangeRateError) {
      throw dexterDAppError || quipuswapExchangersError || tezExchangeRateError;
    }
    let quipuswapExchangeRate = new BigNumber(0);
    let quipuswapWeight = new BigNumber(0);
    let dexterExchangeRate = new BigNumber(0);
    let dexterWeight = new BigNumber(0);
    const tokenElementaryParts = new BigNumber(10).pow(decimals);
    const matchingQuipuswapExchangers = quipuswapExchangers!.filter(
      ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
        tokenAddress === swappableTokenAddress &&
        (swappableTokenId === undefined || swappableTokenId === token_id)
    );
    if (matchingQuipuswapExchangers.length > 0) {
      const exchangersCharacteristics = matchingQuipuswapExchangers.map(
        ({ tezPool, tokenPool }) => {
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
    for (const contractData of dexterDAppData?.contracts ?? []) {
      const { network, address: exchangerAddress } = contractData;
      if (network !== "mainnet") {
        continue;
      }
      const { address: contractTokenAddress, tokenId } =
        await getTokenDescriptor(exchangerAddress, "dexter");
      if (
        contractTokenAddress !== tokenAddress ||
        (tokenId !== undefined && tokenId !== token_id)
      ) {
        continue;
      }
      const { xtzPool, tokenPool } = await getStorage(exchangerAddress);
      if (!xtzPool.eq(0) && !tokenPool.eq(0)) {
        dexterWeight = xtzPool;
        dexterExchangeRate = xtzPool
          .div(1e6)
          .div(tokenPool.div(tokenElementaryParts));
      }
      break;
    }
    if (quipuswapExchangeRate.eq(0) && dexterExchangeRate.eq(0)) {
      return new BigNumber(0);
    }
    return quipuswapExchangeRate
      .times(quipuswapWeight)
      .plus(dexterExchangeRate.times(dexterWeight))
      .div(quipuswapWeight.plus(dexterWeight))
      .times(tezExchangeRate!);
  },
  { promise: true, maxAge: LIQUIDITY_INTERVAL }
);

export type TokenExchangeRateEntry = {
  tokenAddress: string;
  tokenId?: string;
  exchangeRate: BigNumber;
  metadata: BcdTokenData;
};

export const ASPENCOIN_ADDRESS = "KT1S5iPRQ612wcNm6mXDqDhTNegGFcvTV7vM";
tokensMetadataProvider.subscribe("mainnet", ASPENCOIN_ADDRESS);

const getTokensExchangeRates = async (): Promise<TokenExchangeRateEntry[]> => {
  logger.info("Getting tokens exchange rates...");
  const { data: quipuswapExchangers, error: quipuswapError } =
    await quipuswapExchangersDataProvider.getState();
  const { data: dexterDAppData, error: dexterDAppError } =
    await detailedDAppDataProvider.get("dexter");
  const { data: ethTokens, error: ethTokensError } =
    await tzwrapEthTokensProvider.getState();
  if (quipuswapError || dexterDAppError || ethTokensError) {
    throw quipuswapError || dexterDAppError || ethTokensError;
  }
  logger.info("Getting tokens exchange rates from Quipuswap pools");
  let exchangeRates = await Promise.all(
    quipuswapExchangers!
      .reduce((onePerTokenExchangers, exchanger) => {
        const relevantFactories =
          networksQuipuswapFactories.mainnet[
            exchanger.tokenId === undefined ? "FA12" : "FA2"
          ];
        const exchangerFactoryIndex = relevantFactories.indexOf(
          exchanger.factoryAddress
        );
        const alreadyPushedExchangerIndex = onePerTokenExchangers.findIndex(
          ({ tokenAddress, tokenId }) =>
            exchanger.tokenAddress === tokenAddress &&
            exchanger.tokenId === tokenId
        );
        if (alreadyPushedExchangerIndex === -1) {
          onePerTokenExchangers.push(exchanger);
        } else {
          const alreadyPushedExchangerFactory =
            onePerTokenExchangers[alreadyPushedExchangerIndex];
          const alreadyPushedExchangerFactoryIndex = relevantFactories.indexOf(
            alreadyPushedExchangerFactory.factoryAddress
          );
          if (alreadyPushedExchangerFactoryIndex < exchangerFactoryIndex) {
            onePerTokenExchangers[alreadyPushedExchangerIndex] = exchanger;
          }
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
  logger.info("Getting tokens exchange rates from Dexter pools");
  for (const contractData of dexterDAppData?.contracts ?? []) {
    const { network, address: exchangerAddress } = contractData;
    if (network !== "mainnet") {
      continue;
    }
    const { address: contractTokenAddress, tokenId } = await getTokenDescriptor(
      exchangerAddress,
      "dexter"
    );
    if (
      exchangeRates.some(
        ({ tokenAddress, tokenId: candidateTokenId }) =>
          contractTokenAddress === tokenAddress && candidateTokenId === tokenId
      )
    ) {
      continue;
    }
    let tokenMetadata = dexterDAppData?.dex_tokens?.find(
      ({ contract: candidateAddress, token_id: candidateTokenId }) =>
        candidateAddress === contractTokenAddress &&
        (tokenId === undefined || candidateTokenId.toString() === tokenId)
    );
    if (!tokenMetadata) {
      const { data: newTokenMetadata, error: newTokenMetadataError } =
        await tokensMetadataProvider.get(
          "mainnet",
          contractTokenAddress,
          tokenId
        );
      if (newTokenMetadataError) {
        tokenMetadata = {
          network: "mainnet",
          contract: contractTokenAddress,
          token_id: +(tokenId ?? "0"),
          decimals: 0,
        };
      } else {
        tokenMetadata = newTokenMetadata![0];
      }
    }
    exchangeRates.push({
      tokenAddress: contractTokenAddress,
      tokenId,
      exchangeRate: await getPoolTokenExchangeRate({
        contract: contractTokenAddress,
        token_id: tokenId,
      }),
      metadata: tokenMetadata!,
    });
  }
  logger.info("Getting exchange rates for remaining Tzwrap tokens");
  const tzwrapExchangeRates = ethTokens!
    .filter(
      ({ contract: ethTokenContract, token_id: ethTokenId }) =>
        !exchangeRates.some(
          ({ tokenAddress, tokenId }) =>
            tokenAddress === ethTokenContract &&
            (tokenId === undefined || new BigNumber(ethTokenId).eq(tokenId))
        )
    )
    .map(({ price, contract, token_id, ...restProps }) => ({
      tokenAddress: contract,
      exchangeRate: new BigNumber(price),
      tokenId: token_id.toString(),
      metadata: {
        ...restProps,
        token_id,
        contract,
      },
    }));

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

  return [...exchangeRates, ...tzwrapExchangeRates].filter(
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
      (tokenId === undefined || tokenId === token.token_id.toString())
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
