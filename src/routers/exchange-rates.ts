import { Router } from 'express';

import { pricesProvider } from '../utils/coingecko';
import { makeProviderDataRequestHandler } from '../utils/handlers';
import { isDefined } from '../utils/helpers';
import { getExchangeRates } from '../utils/tokens';

export const exchangeRatesRouter = Router();

const makeExchangeRateRequestHandler = (coinId: string) =>
  makeProviderDataRequestHandler(pricesProvider, prices => {
    const value = prices[coinId]?.['usd'];

    if (isDefined(value)) {
      return value;
    }

    throw new Error(`${coinId} exchange rate not found`);
  });

exchangeRatesRouter.get(
  '/all-fiats/tez',
  makeProviderDataRequestHandler(pricesProvider, prices => prices.tezos)
);

exchangeRatesRouter.get('/tez', makeExchangeRateRequestHandler('tezos'));
exchangeRatesRouter.get('/btc', makeExchangeRateRequestHandler('bitcoin'));

exchangeRatesRouter.get(
  '/',
  makeProviderDataRequestHandler(pricesProvider, async prices => {
    const tokensExchangeRates = await getExchangeRates();
    const tezExchangeRate = prices.tezos.usd;

    if (!isDefined(tezExchangeRate)) {
      throw new Error('TEZ exchange rate not found');
    }

    return [...tokensExchangeRates, { exchangeRate: tezExchangeRate.toString() }];
  })
);
