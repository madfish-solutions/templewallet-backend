import { range } from './helpers';
import { makeBuildQueryFn } from './makeBuildQueryFn';
import SingleQueryDataProvider from './SingleQueryDataProvider';

type CoinsListParams = {
  include_platform?: boolean;
};
type MarketsParams = {
  vs_currency?: string;
  ids: string[];
  order?:
    | 'market_cap_desc'
    | 'gecko_desc'
    | 'gecko_asc'
    | 'market_cap_asc'
    | 'market_cap_desc'
    | 'volume_asc'
    | 'volume_desc'
    | 'id_asc'
    | 'id_desc';
  per_page?: number;
  page?: number;
  sparkline?: boolean;
};

type CoinsListItem = {
  id: string;
  symbol: string;
  name: string;
};
type Market = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  last_updated: string;
};

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

const buildQuery = makeBuildQueryFn<CoinsListParams | MarketsParams, CoinsListItem[] | Market[]>(COINGECKO_BASE_URL);

const getCoins = buildQuery<CoinsListParams, CoinsListItem[]>('/coins/list', ['include_platform']);
const getMarkets = buildQuery<MarketsParams, Market[]>(
  '/coins/markets',
  ({ vs_currency = 'usd', ids, order = 'market_cap_desc', per_page = 100, page = 1, sparkline = false }) => ({
    vs_currency,
    ids: ids.join(','),
    order,
    per_page,
    page,
    sparkline
  })
);

export const coinsListProvider = new SingleQueryDataProvider(24 * 3600 * 1000, () => getCoins({}));

export const getMarketsBySymbols = async (symbols: string[]) => {
  const { data: coins, error: coinsError } = await coinsListProvider.getState();
  if (coinsError) {
    throw coinsError;
  }
  const matchingCoins =
    coins?.filter(({ symbol }) =>
      symbols.some(matchingSymbol => matchingSymbol.toLowerCase() === symbol.toLowerCase())
    ) ?? [];
  const pagesNumbers = range(1, matchingCoins.length + 1, 100);
  const ids = matchingCoins.map(({ id }) => id);
  const chunks = await Promise.all(
    pagesNumbers.map(pageNumber =>
      getMarkets({
        ids,
        page: pageNumber
      })
    )
  );

  return chunks.flat();
};
