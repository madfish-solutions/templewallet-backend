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

export type CoinsPrices = Record<string, Record<string, number>>;

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

const buildQuery = makeBuildQueryFn<object, AssetPlatform[] | CoinsPrices>(COINGECKO_BASE_URL, undefined, {
  headers: { [EnvVars.IS_COINGECKO_DEMO ? 'x-cg-demo-api-key' : 'x-cg-pro-api-key']: EnvVars.COINGECKO_API_KEY }
});

const getAssetPlatforms = buildQuery<object, AssetPlatform[]>('/asset_platforms');
const getPrices = buildQuery<GetPricesParams, CoinsPrices>('/simple/price', ({ ids, vs_currencies }) => ({
  ids: ids.join(','),
  vs_currencies: vs_currencies.join(',')
}));

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

export const assetPlatformsProvider = new SingleQueryDataProvider(24 * 3600 * 1000, () => getAssetPlatforms({}));
export const pricesProvider = new SingleQueryDataProvider(15 * 60 * 1000, async () =>
  getPrices({ ids: COINS_IDS, vs_currencies: FIAT_CURRENCIES_CODES })
);
