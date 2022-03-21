import DataProvider from "./DataProvider";
import makeBuildQueryFn from "./makeBuildQueryFn";

const BCD_BASE_URL = "https://api.better-call.dev/v1";

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
  address: string;
  network: string;
  size?: number;
  offset?: number;
  token_id?: number;
};

type TokensMetadataParams = {
  size?: number;
  offset?: number;
  network: string;
  contract?: string;
  token_id?: number;
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
  tokens?: BcdTokenData[];
  dex_tokens?: BcdTokenData[];
};

type AccountTokenBalancesResponse = {
  balances: (BcdTokenData & {
    balance: string;
  })[];
  total: number;
};

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
  extras?: Record<string, any>;
  token_info?: Record<string, any>;
  supply?: string;
};

const buildQuery = makeBuildQueryFn<
  | SeriesParams
  | {}
  | { slug: string }
  | AccountTokenBalancesParams
  | ContractTokensParams,
  | [number, number][]
  | DAppsListItem[]
  | DAppDetails
  | AccountTokenBalancesResponse
  | BcdTokenData[]
>(BCD_BASE_URL, 5);

export const getAccountTokenBalances = buildQuery<
  AccountTokenBalancesParams,
  AccountTokenBalancesResponse
>(
  (params) => `/account/${params.network}/${params.address}/token_balances`,
  ["offset", "size", "contract"]
);

const getContractTokens = buildQuery<ContractTokensParams, BcdTokenData[]>(
  (params) => `/contract/${params.network}/${params.address}/tokens`,
  ["size", "offset", "token_id"]
);

const getTokensMetadata = buildQuery<TokensMetadataParams, BcdTokenData[]>(
  (params) => `/tokens/${params.network}/metadata`,
  ["size", "offset", "contract", "token_id"]
);

export const tokensMetadataProvider = new DataProvider(
  24 * 3600 * 1000,
  (network: string, address?: string, token_id?: number) =>
    getTokensMetadata({
      network,
      contract: address,
      token_id,
    })
);

export const contractTokensProvider = new DataProvider(
  24 * 3600 * 1000,
  (
    network: string,
    address: string,
    token_id?: number,
    size?: number,
    offset?: number
  ) =>
    getContractTokens({
      network,
      address,
      size,
      offset,
      token_id,
    })
);