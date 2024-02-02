import { BigNumber } from 'bignumber.js';

import { redisClient } from '../redis';
import { isDefined } from './helpers';
import logger from './logger';
import SingleQueryDataProvider, { SingleQueryDataProviderState } from './SingleQueryDataProvider';
import { tezExchangeRateProvider } from './tezos';
import {
  getThreeRouteExchangeRates,
  getThreeRouteTokens,
  ThreeRouteStandardEnum,
  ThreeRouteFa12Token,
  ThreeRouteFa2Token
} from './three-route';
import { BcdTokenData, mapTzktTokenDataToBcdTokenData, tokensMetadataProvider } from './tzkt';

interface TokenExchangeRateEntry {
  tokenAddress: string;
  tokenId?: number;
  exchangeRate: BigNumber;
  metadata?: BcdTokenData;
  swapsUpdatedAt?: string;
}

const tokensListProvider = new SingleQueryDataProvider(30000, () => getThreeRouteTokens({}));
const threeRouteExchangeRatesProvider = new SingleQueryDataProvider(30000, () => getThreeRouteExchangeRates({}));

const EXCHANGE_RATES_STORAGE_KEY = 'exchange_rates';

const getTokensExchangeRates = async (): Promise<TokenExchangeRateEntry[]> => {
  logger.info('Getting tokens exchange rates...');
  logger.info('Getting exchange rates of tokens which are known to 3route...');
  const { data: tokens, error: tokensError } = await tokensListProvider.getState();
  const { data: exchangeRatesInputs, error: exchangeRatesError } = await threeRouteExchangeRatesProvider.getState();
  const { data: tezExchangeRate, error: tezExchangeRateError } = await tezExchangeRateProvider.getState();

  const error = tokensError ?? exchangeRatesError ?? tezExchangeRateError;
  if (error) {
    throw error;
  }

  const exchangeRatesWithHoles = await Promise.all(
    tokens
      .filter(
        (token): token is ThreeRouteFa12Token | ThreeRouteFa2Token => token.standard !== ThreeRouteStandardEnum.xtz
      )
      .map(async (token): Promise<TokenExchangeRateEntry | undefined> => {
        const { contract, tokenId: rawTokenId, symbol } = token;
        const tokenId = isDefined(rawTokenId) ? Number(rawTokenId) : undefined;
        const { ask, bid } = exchangeRatesInputs[symbol] ?? { ask: 0, bid: 0 };

        if (ask === 0 && bid === 0) {
          logger.error(`Failed to get exchange rate for token ${token.symbol}`);

          return undefined;
        }

        const { data: metadata } = await tokensMetadataProvider.get(contract, tokenId);
        const tokensPerTez = ask === 0 ? bid : ask;
        const exchangeRate = new BigNumber(1).div(tokensPerTez).times(tezExchangeRate);

        return {
          tokenAddress: contract,
          tokenId,
          exchangeRate,
          metadata: mapTzktTokenDataToBcdTokenData(metadata?.[0]),
          swapsUpdatedAt: new Date().toISOString()
        };
      })
  );

  const exchangeRates = exchangeRatesWithHoles.filter(isDefined);

  logger.info('Successfully got tokens exchange rates');
  const newExchangeRates = [...exchangeRates].filter(({ exchangeRate }) => !exchangeRate.eq(0));
  await redisClient.set(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(newExchangeRates));

  return newExchangeRates;
};

const tokensExchangeRatesProvider = new SingleQueryDataProvider(30000, getTokensExchangeRates);

const getExchangeRatesFromDB = async (): Promise<TokenExchangeRateEntry[]> => {
  const rawValue = await redisClient.get(EXCHANGE_RATES_STORAGE_KEY);

  return JSON.parse(rawValue ?? '[]');
};

export const getExchangeRates = async () => {
  const providerState = await Promise.race([
    tokensExchangeRatesProvider.getState(),
    new Promise<SingleQueryDataProviderState<TokenExchangeRateEntry[]>>(res =>
      setTimeout(() => res({ error: new Error('Timeout') }), 1000)
    )
  ]);

  return providerState.data ?? (await getExchangeRatesFromDB());
};
