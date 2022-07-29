import BigNumber from "bignumber.js";
import memoizee from "memoizee";
import {
  BcdTokenData,
  contractTokensProvider,
  tokensMetadataProvider,
} from "./better-call-dev";
import fetch from "./fetch";
import {
  getTokenMetadata,
  getStorage,
  tezExchangeRateProvider,
} from "./tezos";
import SingleQueryDataProvider from "./SingleQueryDataProvider";
import { range } from "./helpers";
import { MichelsonMap } from "@taquito/michelson-encoder";
import logger from "./logger";

const fa12Factories = process.env.QUIPUSWAP_FA12_FACTORIES!.split(",");
const fa2Factories = process.env.QUIPUSWAP_FA2_FACTORIES!.split(",");

type QuipuswapExchanger = {
  exchangerAddress: string;
  tokenAddress: string;
  tokenId?: number;
  tokenMetadata: BcdTokenData | undefined;
};

const getQuipuswapExchangers = async (): Promise<QuipuswapExchanger[]> => {
  const fa12FactoryStorages = await Promise.all(
    fa12Factories.map((factoryAddress) => getStorage(factoryAddress))
  );
  const fa2FactoryStorages = await Promise.all(
    fa2Factories.map((factoryAddress) => getStorage(factoryAddress))
  );
  logger.info("Getting FA1.2 Quipuswap exchangers...");
  const rawFa12FactoryTokens: MichelsonMap<string, string>[] =
    await Promise.all(
      fa12FactoryStorages.map((storage) => {
        return storage.token_list.getMultipleValues(
          range(0, storage.counter.toNumber())
        );
      })
    );
  const rawFa12Exchangers: MichelsonMap<string, string>[] = await Promise.all(
    fa12FactoryStorages.map((storage, index) =>
      storage.token_to_exchange.getMultipleValues([
        ...rawFa12FactoryTokens[index].values(),
      ])
    )
  );
  const fa12Exchangers = (
    await Promise.all(
      rawFa12Exchangers.map((rawFa12ExchangersChunk) => {
        return Promise.all(
          [...rawFa12ExchangersChunk.entries()].map(
            async ([tokenAddress, exchangerAddress]) => {
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
              };
            }
          )
        );
      })
    )
  ).flat();

  logger.info("Getting FA2 Quipuswap exchangers...");
  const rawFa2FactoryTokens: MichelsonMap<number, [string, BigNumber]>[] =
    await Promise.all(
      fa2FactoryStorages.map((storage) =>
        storage.token_list.getMultipleValues(
          range(0, storage.counter.toNumber())
        )
      )
    );

  const rawFa2Exchangers = await Promise.all(
    rawFa2FactoryTokens.map((rawTokens, index) => {
      return Promise.all(
        [...rawTokens.values()].map(
          async (token): Promise<[[string, BigNumber], string]> => [
            token,
            await fa2FactoryStorages[index].token_to_exchange.get(token),
          ]
        )
      );
    })
  );

  const fa2Exchangers = (
    await Promise.all(
      rawFa2Exchangers
        .flat()
        .map(async ([tokenDescriptor, exchangerAddress]) => {
          const address = tokenDescriptor[0];
          const token_id = tokenDescriptor[1].toNumber();
          await contractTokensProvider.subscribe("mainnet", address, token_id);
          const { data: tokensMetadata, error } =
            await contractTokensProvider.get("mainnet", address, token_id);
          if (error) {
            throw error;
          }
          return {
            exchangerAddress,
            tokenAddress: address,
            tokenId: token_id,
            tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
          };
        })
    )
  ).flat();
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
        if (!metadata || metadata.length === 0 || !metadata[0].decimals) {
          try {
            decimals = (await getTokenMetadata(tokenAddress, token_id)).decimals;
          } catch(e) {
            if(tokenAddress === 'KT1Xobej4mc6XgEjDoJoHtTKgbD1ELMvcQuL' && token_id === 0) {
              decimals = 12;
            } else {
              decimals = 0;
            }
          }
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
    let dexterExchangeRate = new BigNumber(0);
    let dexterWeight = new BigNumber(0);
    const tokenElementaryParts = new BigNumber(10).pow(decimals);
    const matchingQuipuswapExchangers = quipuswapExchangers!.filter(
      ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
        tokenAddress === swappableTokenAddress &&
        (swappableTokenId === undefined || swappableTokenId === token_id)
    );
    if (matchingQuipuswapExchangers.length > 0) {
      const exchangersCharacteristics = await Promise.all(
        matchingQuipuswapExchangers.map(async ({ exchangerAddress }) => {
          const {
            storage: { tez_pool, token_pool },
          } = await getStorage(exchangerAddress);
          if (!tez_pool.eq(0) && !token_pool.eq(0)) {
            return {
              weight: tez_pool,
              exchangeRate: tez_pool
                .div(1e6)
                .div(token_pool.div(tokenElementaryParts)),
            };
          }
          return { weight: new BigNumber(0), exchangeRate: new BigNumber(0) };
        })
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
