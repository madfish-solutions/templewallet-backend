import { AxiosError, AxiosRequestConfig } from 'axios';

import { EnvVars } from '../config';

import { makeBuildQueryFn } from './makeBuildQueryFn';
import SingleQueryDataProvider from './SingleQueryDataProvider';

interface AssetPlatform {
  id: string;
  chain_identifier: number | null;
  name: string;
  shortname: string;
  native_coin_id: string | null;
  image: Record<'thumb' | 'small' | 'large', string | null>;
}

interface GetPricesParams {
  ids: string[];
  vs_currencies: string[];
}

interface MarketsParams {
  vs_currency: string;
  category?: string;
}
interface Market {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
  market_cap_change_24h: number | null;
  market_cap_change_percentage_24h: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
  last_updated: string;
}

export type CoinsPrices = Record<string, Record<string, number>>;

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

type CoingeckoRequest = object;
type CoingeckoResponse = AssetPlatform[] | CoinsPrices | Market[];

const buildApiTokenQuery = makeBuildQueryFn<CoingeckoRequest, CoingeckoResponse>(COINGECKO_BASE_URL, undefined, {
  headers: { [EnvVars.IS_COINGECKO_DEMO ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key']: EnvVars.COINGECKO_API_KEY }
});
const buildNoTokenQuery = makeBuildQueryFn<CoingeckoRequest, CoingeckoResponse>(COINGECKO_BASE_URL);
const buildQuery = <P1 extends CoingeckoRequest, R1 extends CoingeckoResponse>(
  path: string | ((params: P1) => string),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toQueryParams?: (keyof P1)[] | ((params: P1) => Record<string, any>),
  config?: Omit<AxiosRequestConfig, 'url'>
) => {
  const noTokenQueryFn = buildNoTokenQuery(path, toQueryParams, config);
  const apiTokenQueryFn = buildApiTokenQuery(path, toQueryParams, config);

  return async (params: P1) => {
    try {
      return await (noTokenQueryFn(params) as Promise<R1>);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 403) {
        return await (apiTokenQueryFn(params) as Promise<R1>);
      }
      throw error;
    }
  };
};

const getPrices = buildQuery<GetPricesParams, CoinsPrices>('/simple/price', ({ ids, vs_currencies }) => ({
  ids: ids.join(','),
  vs_currencies: vs_currencies.join(',')
}));
const getMarketsPage = buildQuery<MarketsParams, Market[]>('/coins/markets', ['vs_currency', 'category']);

const FIAT_CURRENCIES_CODES = [
  'usd',
  'eur',
  'gbp',
  'jpy',
  'aud',
  'cad',
  'chf',
  'cny',
  'dkk',
  'hkd',
  'idr',
  'inr',
  'krw',
  'mxn',
  'nzd',
  'pln',
  'sek',
  'sgd',
  'thb',
  'try',
  'twd',
  'uah',
  'zar'
];
const COINS_IDS = ['tezos', 'bitcoin'];

export const tezosMarketsProvider = new SingleQueryDataProvider(EnvVars.COINGECKO_POLLING_INTERVAL, async () =>
  getMarketsPage({ vs_currency: 'usd', category: 'tezos-ecosystem' })
);
export const pricesProvider = new SingleQueryDataProvider(EnvVars.COINGECKO_POLLING_INTERVAL, async () =>
  getPrices({ ids: COINS_IDS, vs_currencies: FIAT_CURRENCIES_CODES })
);
