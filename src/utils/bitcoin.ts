import { AxiosError } from 'axios';

import { getMarketsBySymbols } from './coingecko';
import { isDefined } from './helpers';
import logger from './logger';
import SingleQueryDataProvider from './SingleQueryDataProvider';

const getBtcExchangeRate = async () => {
  try {
    const [btcMarket] = await getMarketsBySymbols(['btc']);

    return btcMarket.current_price;
  } catch (e) {
    if (!(e instanceof AxiosError)) {
      logger.error('Request for BTC exchange rate failed with unknown error');
    } else if (isDefined(e.response) && isDefined(e.response.data)) {
      logger.error(
        `Request for BTC exchange rate failed with status ${e.response.status} and message ${e.response.data}`
      );
    } else if (isDefined(e.response) && isDefined(e.response.status)) {
      logger.error(`Request for BTC exchange rate failed with status ${e.response.status}`);
    } else {
      logger.error('Request for BTC exchange rate failed without response');
    }

    throw e;
  }
};

export const btcExchangeRateProvider = new SingleQueryDataProvider(60000, getBtcExchangeRate);
