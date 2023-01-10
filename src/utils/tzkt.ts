import DataProvider from "./DataProvider";
import makeBuildQueryFn from "./makeBuildQueryFn";

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

export enum TZKT_NETWORKS {
  MAINNET = 'mainnet',
  GHOSTNET = 'ghostnet',
  JAKARTANET = 'jakartanet'
}

const TZKT_BASE_URL_MAINNET = 'https://api.tzkt.io/v1'
const TZKT_BASE_URL_GHOSTNET = 'https://api.ghostnet.tzkt.io/v1'

type SeriesParams = {
  addresses: string[];
  period: "day" | "month" | "year";
  name: "users" | "operation";
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

const buildQueryMainnet = makeBuildQueryFn<
  | SeriesParams
  | object
  | { slug: string }
  | AccountTokenBalancesParams
  | ContractTokensParams,
  | [number, number][]
  | DAppsListItem[]
  | DAppDetails
  | AccountTokenBalancesResponse
  | TzktTokenData[]
>(TZKT_BASE_URL_MAINNET, 5);

const buildQueryGhostnet = makeBuildQueryFn<
  | SeriesParams
  | object
  | { slug: string }
  | AccountTokenBalancesParams
  | ContractTokensParams,
  | [number, number][]
  | DAppsListItem[]
  | DAppDetails
  | AccountTokenBalancesResponse
  | TzktTokenData[]
>(TZKT_BASE_URL_GHOSTNET, 5);

export const tokensMetadataProvider = new DataProvider(
  24 * 3600 * 1000,
  (network: TZKT_NETWORKS, address?: string, token_id?: number) => {
    const getTokensMetadata = network === TZKT_NETWORKS.MAINNET ? buildQueryMainnet<TokensMetadataParams, TzktTokenData[]>(
      () => `/tokens`,
      ["limit", "offset", "contract", "tokenId"]
    ) : buildQueryGhostnet<TokensMetadataParams, TzktTokenData[]>(
      () => `/tokens`,
      ["limit", "offset", "contract", "tokenId"]
    );

return getTokensMetadata({
      contract: address,
      tokenId: token_id
    })
  }
);

export const contractTokensProvider = new DataProvider(
  24 * 3600 * 1000,
  (
    network: TZKT_NETWORKS,
    address: string,
    token_id?: number,
    size?: number,
    offset?: number
  ) =>
  {
    const getContractTokens = network === TZKT_NETWORKS.MAINNET ? buildQueryMainnet<ContractTokensParams, TzktTokenData[]>(
      () => `/tokens`,
      ["limit", "offset", "tokenId", "contract"]
    ) : buildQueryGhostnet<ContractTokensParams, TzktTokenData[]>(
      () => `/tokens`,
      ["limit", "offset", "tokenId", "contract"]
    );

return getContractTokens({
      contract: address,
      limit: size,
      offset,
      tokenId: token_id
    })
  }
);

export const mapTzktTokenDataToBcdTokenData = (x?: TzktTokenData) : BcdTokenData | undefined => !x? undefined : ({
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
})
