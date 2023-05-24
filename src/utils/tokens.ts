import { MichelsonMap } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';
import memoizee from 'memoizee';

import { EnvVars } from '../config';
import { BigMapKeyType, IContractFactoryStorage, TokenListValue } from '../interfaces/contract-factoctories';
import { IPriceHistory } from '../interfaces/price-history';
import fetch from './fetch';
import { rangeBn } from './helpers';
import logger from './logger';
import SingleQueryDataProvider from './SingleQueryDataProvider';
import { getTokenMetadata, getStorage, tezExchangeRateProvider } from './tezos';
import {
  BcdTokenData,
  contractTokensProvider,
  mapTzktTokenDataToBcdTokenData,
  tokensMetadataProvider,
  TZKT_NETWORKS,
  TzktTokenData
} from './tzkt';

const fa12Factories = EnvVars.QUIPUSWAP_FA12_FACTORIES.split(',');
const fa2Factories = EnvVars.QUIPUSWAP_FA2_FACTORIES.split(',');

interface QuipuswapExchangerAbstract {
  exchangerAddress: string;
  tokenAddress: string;
  tokenId?: number;
}
interface QuipuswapExchanger extends QuipuswapExchangerAbstract {
  tokenMetadata: BcdTokenData | undefined;
}
interface QuipuswapExchangerRaw extends QuipuswapExchangerAbstract {
  tokenMetadata: TzktTokenData | undefined;
}

const getQuipuswapExchangers = async (): Promise<QuipuswapExchanger[]> => {
  const fa12FactoryStorages = await Promise.all(
    fa12Factories.map(factoryAddress => getStorage<IContractFactoryStorage>(factoryAddress))
  );
  const fa2FactoryStorages = await Promise.all(
    fa2Factories.map(factoryAddress => getStorage<IContractFactoryStorage>(factoryAddress))
  );
  logger.info('Getting FA1.2 Quipuswap exchangers...');
  const rawFa12FactoryTokens = await Promise.all(
    fa12FactoryStorages.map(storage => {
      return storage.token_list.getMultipleValues(rangeBn(0, storage.counter.toNumber()));
    })
  );
  const rawFa12FactoryTokensFiltered: Array<MichelsonMap<BigMapKeyType, TokenListValue>> = [];
  rawFa12FactoryTokens.forEach((item, index) => {
    const value = item.get(new BigNumber(index));
    if (value !== undefined) {
      rawFa12FactoryTokensFiltered.push(item as MichelsonMap<BigMapKeyType, TokenListValue>);
    }
  });
  const rawFa12Exchangers = await Promise.all(
    fa12FactoryStorages.map((storage, index) =>
      storage.token_to_exchange.getMultipleValues([...rawFa12FactoryTokensFiltered[index].values()])
    )
  );
  const fa12Exchangers = (
    await Promise.all(
      rawFa12Exchangers.map(rawFa12ExchangersChunk => {
        return Promise.all(
          [...rawFa12ExchangersChunk.entries()].map(async ([tokenAddress, exchangerAddress]) => {
            await contractTokensProvider.subscribe(TZKT_NETWORKS.MAINNET, tokenAddress.toString());
            const { data: tokensMetadata, error } = await contractTokensProvider.get(
              TZKT_NETWORKS.MAINNET,
              tokenAddress.toString()
            );
            if (error) {
              throw error;
            }

            return {
              tokenAddress: tokenAddress.toString(),
              exchangerAddress,
              tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined
            };
          })
        );
      })
    )
  ).flat();

  logger.info('Getting FA2 Quipuswap exchangers...');
  const rawFa2FactoryTokens = await Promise.all(
    fa2FactoryStorages.map(storage => storage.token_list.getMultipleValues(rangeBn(0, storage.counter.toNumber())))
  );

  const rawFa2Exchangers = await Promise.all(
    rawFa2FactoryTokens.map((rawTokens, index) => {
      return Promise.all(
        [...rawTokens.values()].map(async (token): Promise<[[string, BigNumber], string] | undefined> => {
          if (token !== undefined) {
            const exchange = await fa2FactoryStorages[index].token_to_exchange.get(token);
            if (exchange !== undefined) {
              return [token, exchange];
            }
          }
        })
      );
    })
  );

  const rawFa2ExchangersFiltered: [[string, BigNumber], string][][] = [];
  rawFa2Exchangers.forEach(exchanger => {
    exchanger.forEach(item => {
      if (item !== undefined) {
        rawFa2ExchangersFiltered.push([item]);
      }
    });
  });

  const fa2Exchangers = (
    await Promise.all(
      rawFa2ExchangersFiltered.flat().map(async ([tokenDescriptor, exchangerAddress]) => {
        const address = tokenDescriptor[0];
        const token_id = tokenDescriptor[1].toNumber();
        await contractTokensProvider.subscribe(TZKT_NETWORKS.MAINNET, address, token_id);
        const { data: tokensMetadata, error } = await contractTokensProvider.get(
          TZKT_NETWORKS.MAINNET,
          address,
          token_id
        );
        if (error) {
          throw error;
        }

        return {
          exchangerAddress,
          tokenAddress: address,
          tokenId: token_id,
          tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined
        };
      })
    )
  ).flat();
  logger.info('Successfully got Quipuswap exchangers');

  const allExhangers = [...fa12Exchangers, ...fa2Exchangers];
  const allExhangersFiltered: Array<QuipuswapExchangerRaw> = [];
  allExhangers.forEach(item => {
    if (item.exchangerAddress !== undefined) {
      allExhangersFiltered.push(item as QuipuswapExchangerRaw);
    }
  });

  return allExhangersFiltered.map(exchanger => ({
    ...exchanger,
    tokenMetadata: mapTzktTokenDataToBcdTokenData(exchanger.tokenMetadata)
  }));
};
export const quipuswapExchangersDataProvider = new SingleQueryDataProvider(14 * 60 * 1000, getQuipuswapExchangers);

const LIQUIDITY_INTERVAL = 120000;
const getPoolTokenExchangeRate = memoizee(
  async ({
    contract: tokenAddress,
    decimals,
    token_id
  }: {
    decimals?: number;
    token_id?: number;
    contract: string;
  }) => {
    if (decimals === undefined) {
      try {
        await tokensMetadataProvider.subscribe(TZKT_NETWORKS.MAINNET, tokenAddress, token_id);
        const { data: metadata } = await tokensMetadataProvider.get(TZKT_NETWORKS.MAINNET, tokenAddress, token_id);
        if (!metadata || metadata.length === 0 || !metadata[0].metadata.decimals) {
          decimals = await getTokenMetadata(tokenAddress, token_id)
            .then(x => x.decimals)
            .catch(() => (tokenAddress === 'KT1Xobej4mc6XgEjDoJoHtTKgbD1ELMvcQuL' && token_id === 0 ? 12 : 0));
        } else {
          decimals = metadata[0].metadata.decimals;
        }
      } catch (e) {
        decimals = 0;
      }
    }

    const { data: tezExchangeRate, error: tezExchangeRateError } = await tezExchangeRateProvider.getState();
    const { data: quipuswapExchangers, error: quipuswapExchangersError } =
      await quipuswapExchangersDataProvider.getState();
    if (quipuswapExchangersError || tezExchangeRateError) {
      throw quipuswapExchangersError || tezExchangeRateError;
    }
    let quipuswapExchangeRate = new BigNumber(0);
    let quipuswapWeight = new BigNumber(0);
    const dexterExchangeRate = new BigNumber(0);
    const dexterWeight = new BigNumber(0);
    const tokenElementaryParts = new BigNumber(10).pow(decimals);
    const matchingQuipuswapExchangers =
      quipuswapExchangers?.filter(
        ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
          tokenAddress === swappableTokenAddress && (swappableTokenId === undefined || swappableTokenId === token_id)
      ) ?? [];
    if (matchingQuipuswapExchangers.length > 0) {
      const exchangersCharacteristics = await Promise.all(
        matchingQuipuswapExchangers.map(async ({ exchangerAddress }) => {
          const {
            storage: { tez_pool, token_pool }
          } = await getStorage<{
            storage: {
              tez_pool: BigNumber;
              token_pool: BigNumber;
            };
          }>(exchangerAddress);

          if (!tez_pool.eq(0) && !token_pool.eq(0)) {
            return {
              weight: tez_pool,
              exchangeRate: tez_pool.div(1e6).div(token_pool.div(tokenElementaryParts))
            };
          }

          return { weight: new BigNumber(0), exchangeRate: new BigNumber(0) };
        })
      );
      quipuswapWeight = exchangersCharacteristics.reduce((sum, { weight }) => sum.plus(weight), new BigNumber(0));
      if (!quipuswapWeight.eq(0)) {
        quipuswapExchangeRate = exchangersCharacteristics
          .reduce((sum, { weight, exchangeRate }) => sum.plus(weight.multipliedBy(exchangeRate)), new BigNumber(0))
          .div(quipuswapWeight);
      }
    }
    if (quipuswapExchangeRate.eq(0) && dexterExchangeRate.eq(0)) {
      return new BigNumber(0);
    }

    if (tezExchangeRate === undefined || typeof tezExchangeRate === 'boolean') {
      return new BigNumber(0);
    }

    return quipuswapExchangeRate
      .times(quipuswapWeight)
      .plus(dexterExchangeRate.times(dexterWeight))
      .div(quipuswapWeight.plus(dexterWeight))
      .times(tezExchangeRate);
  },
  { promise: true, maxAge: LIQUIDITY_INTERVAL }
);

export type TokenExchangeRateEntry = {
  tokenAddress: string;
  tokenId?: number;
  exchangeRate: BigNumber;
  metadata?: BcdTokenData;
};

export const ASPENCOIN_ADDRESS = 'KT1S5iPRQ612wcNm6mXDqDhTNegGFcvTV7vM';
tokensMetadataProvider.subscribe(TZKT_NETWORKS.MAINNET, ASPENCOIN_ADDRESS);

const getTokensExchangeRates = async (): Promise<TokenExchangeRateEntry[]> => {
  logger.info('Getting tokens exchange rates...');
  const { data: quipuswapExchangers, error: quipuswapError } = await quipuswapExchangersDataProvider.getState();
  if (quipuswapError) {
    throw quipuswapError;
  }
  logger.info('Getting tokens exchange rates from Quipuswap pools');
  const exchangeRates = await Promise.all(
    quipuswapExchangers
      ?.reduce((onePerTokenExchangers, exchanger) => {
        if (
          !onePerTokenExchangers.some(
            ({ tokenAddress, tokenId }) => exchanger.tokenAddress === tokenAddress && exchanger.tokenId === tokenId
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
            token_id: tokenId
          }),
          metadata: tokenMetadata
        };
      }) ?? []
  );

  if (!exchangeRates.some(({ tokenAddress }) => tokenAddress === ASPENCOIN_ADDRESS)) {
    logger.info('Getting exchange rate for Aspencoin');
    try {
      const { data: aspencoinMetadata, error: aspencoinMetadataError } = await tokensMetadataProvider.get(
        TZKT_NETWORKS.MAINNET,
        ASPENCOIN_ADDRESS
      );
      if (aspencoinMetadataError) {
        throw aspencoinMetadataError;
      }
      const priceHistory = await fetch<IPriceHistory>(
        'https://gateway-web-markets.tzero.com/mdt/public-pricehistory/ASPD?page=1'
      );
      const latestValidEntry = priceHistory.priceHistories.find(({ close }) => close !== null);
      const tokenPrice = latestValidEntry ? new BigNumber(latestValidEntry.close ?? 0) : new BigNumber(0);

      exchangeRates.push({
        tokenAddress: ASPENCOIN_ADDRESS,
        tokenId: undefined,
        exchangeRate: tokenPrice,
        metadata: mapTzktTokenDataToBcdTokenData(aspencoinMetadata?.[0])
      });
    } catch (e) {}
  }

  logger.info('Successfully got tokens exchange rates');

  return [...exchangeRates /*, ...tzwrapExchangeRates */].filter(({ exchangeRate }) => !exchangeRate.eq(0));
};

export const tokensExchangeRatesProvider = new SingleQueryDataProvider(13 * 60 * 1000, getTokensExchangeRates);
