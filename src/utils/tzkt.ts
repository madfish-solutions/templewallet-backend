import DataProvider from './DataProvider';
import makeBuildQueryFn from './makeBuildQueryFn';

export type BcdTokenData = {
  network: string;
  contract: string;
  token_id: number;
  symbol?: string;
  name?: string;
  decimals: number;
  is_transferable?: boolean;
  is_boolean_amount?: boolean;
  should_prefer_symbol?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  token_info?: Record<string, any>;
  supply?: string;
};

const TZKT_BASE_URL = 'https://api.tzkt.io/v1';

type SeriesParams = {
  addresses: string[];
  period: 'day' | 'month' | 'year';
  name: 'users' | 'operation';
};

type AccountTokenBalancesParams = {
  network: string;
  address: string;
  offset?: number;
  size?: number;
  contract?: string;
};

type ContractTokensParams = {
  contract: string;
  limit?: number;
  offset?: number;
  tokenId?: number;
};

type TokensMetadataParams = {
  limit?: number;
  offset?: number;
  contract?: string;
  tokenId?: number;
};

export type DAppsListItem = {
  name: string;
  dappUrl: string;
  type: string;
  logo: string;
  slug: string;
  categories: string[];
};

export type DAppDetails = DAppsListItem & {
  contracts?: {
    network: string;
    address: string;
  }[];
  tokens?: TzktTokenData[];
  dex_tokens?: TzktTokenData[];
};

type AccountTokenBalancesResponse = {
  balances: (TzktTokenData & {
    balance: string;
  })[];
  total: number;
};

export type TzktTokenData = {
  contract: {
    address: string;
    alias?: string;
  };
  tokenId: string;
  metadata: {
    name?: string;
    symbol?: string;
    decimals: number;
    isTransferable?: boolean;
    isBooleanAmount?: boolean;
    shouldPreferSymbol?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extras?: Record<string, any>;
  };
  totalSupply?: string;
};

interface TzktBlockQueryParams {
  level: number;
  operations: boolean;
}

interface TzktBlockOperationsResponse {
  transactions:
    | {
        type: string;
        target: {
          alias: string | null;
          address: string | null;
        } | null;
      }[]
    | null;
}

const buildTzktQuery = makeBuildQueryFn<
  SeriesParams | object | { slug: string } | AccountTokenBalancesParams | ContractTokensParams | TzktBlockQueryParams,
  | [number, number][]
  | DAppsListItem[]
  | DAppDetails
  | AccountTokenBalancesResponse
  | TzktTokenData[]
  | TzktBlockOperationsResponse
>(TZKT_BASE_URL, 5);

const makeTokensQuery = buildTzktQuery<TokensMetadataParams, TzktTokenData[]>(
  () => '/tokens',
  ['limit', 'offset', 'contract', 'tokenId']
);

export const makeBlockQuery = buildTzktQuery<TzktBlockQueryParams, TzktBlockOperationsResponse>(
  ({ level }) => `/blocks/${level}`,
  ['operations']
);

export const tokensMetadataProvider = new DataProvider(24 * 3600 * 1000, async (address?: string, token_id?: number) =>
  makeTokensQuery({
    contract: address,
    tokenId: token_id
  })
);

export const contractTokensProvider = new DataProvider(
  24 * 3600 * 1000,
  async (address: string, token_id?: number, size?: number, offset?: number) =>
    makeTokensQuery({
      contract: address,
      limit: size,
      offset,
      tokenId: token_id
    })
);

export const mapTzktTokenDataToBcdTokenData = (x?: TzktTokenData): BcdTokenData | undefined =>
  !x
    ? undefined
    : {
        network: 'mainnet',
        contract: x.contract.address,
        token_id: Number(x.tokenId),
        symbol: x.metadata?.symbol,
        name: x.metadata?.name,
        decimals: x.metadata?.decimals,
        is_transferable: x.metadata?.isTransferable,
        is_boolean_amount: x.metadata?.isBooleanAmount,
        should_prefer_symbol: x.metadata?.shouldPreferSymbol,
        extras: x.metadata?.extras,
        token_info: x.metadata,
        supply: x.totalSupply
      };
