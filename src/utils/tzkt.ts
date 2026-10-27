import retry from 'async-retry';
import { AxiosError } from 'axios';

import DataProvider from './DataProvider';
import { isDefined } from './helpers';
import logger from './logger';
import { makeBuildQueryFn } from './makeBuildQueryFn';

export interface BcdTokenData {
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
}

const TZKT_BASE_URL = 'https://api.tzkt.io/v1';

interface SeriesParams {
  addresses: string[];
  period: 'day' | 'month' | 'year';
  name: 'users' | 'operation';
}

interface AccountTokenBalancesParams {
  network: string;
  address: string;
  offset?: number;
  size?: number;
  contract?: string;
}

interface ContractTokensParams {
  contract: string;
  limit?: number;
  offset?: number;
  tokenId?: number;
}

interface TokensMetadataParams {
  limit?: number;
  offset?: number;
  contract?: string;
  tokenId?: number;
}

interface AccountTokenBalancesResponse {
  balances: (TzktTokenData & {
    balance: string;
  })[];
  total: number;
}

export interface TzktTransaction {
  id: number;
  parameter?: {
    entrypoint?: string;
    value?: unknown;
  } | null;
}

export interface TzktTokenTransfer {
  transactionId?: number;
  timestamp: string;
  amount: string;
  from?: { address?: string } | null;
  to?: { address?: string } | null;
}

interface TzktTokenBalance {
  balance: string;
}

interface TransactionsByHashParams {
  hash: string;
}

interface TokenTransfersParams {
  level: number;
  contract: string;
  tokenId: string;
  limit: number;
  offset: number;
}

interface TokenBalancesParams {
  account: string;
  contract: string;
}

interface TzktTokenData {
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
}

const TZKT_REQUEST_TIMEOUT_MS = 30_000;
const TZKT_MAX_CONCURRENT_REQUESTS = 4;
const TZKT_MAX_RETRIES = 5;
const TZKT_RETRY_BASE_DELAY_MS = 500;
const TZKT_RETRY_MAX_DELAY_MS = 30_000;

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const isRetryableTzktError = (error: unknown) => {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const status = error.response?.status;

  return !isDefined(status) || RETRYABLE_STATUS_CODES.has(status);
};

const toError = (error: unknown) => (error instanceof Error ? error : new Error('TzKT request failed'));

type RetryOutcome<T> = { ok: true; value: T } | { ok: false };

/** Backoff stays outside the shared request slot. */
const withTzktRetry =
  <P, R>(query: (params: P) => Promise<R>) =>
  async (params: P) => {
    const outcome = await retry(
      async (bail: (error: Error) => void): Promise<RetryOutcome<R>> => {
        try {
          const value = await query(params);

          return { ok: true, value };
        } catch (error) {
          if (isRetryableTzktError(error)) {
            throw error;
          }

          bail(toError(error));

          return { ok: false };
        }
      },
      {
        retries: TZKT_MAX_RETRIES,
        factor: 2,
        minTimeout: TZKT_RETRY_BASE_DELAY_MS,
        maxTimeout: TZKT_RETRY_MAX_DELAY_MS,
        randomize: true,
        onRetry: (error, attempt) => {
          logger.warn(`TzKT request failed, retrying (${attempt}): ${error.message}`);
        }
      }
    );

    if (!outcome.ok) {
      throw new Error('TzKT request failed');
    }

    return outcome.value;
  };

const buildTzktQuery = makeBuildQueryFn<
  | SeriesParams
  | object
  | { slug: string }
  | AccountTokenBalancesParams
  | ContractTokensParams
  | TransactionsByHashParams
  | TokenTransfersParams
  | TokenBalancesParams,
  | [number, number][]
  | AccountTokenBalancesResponse
  | TzktTokenData[]
  | TzktTransaction[]
  | TzktTokenTransfer[]
  | TzktTokenBalance[]
>(TZKT_BASE_URL, TZKT_MAX_CONCURRENT_REQUESTS);

const makeTokensQuery = withTzktRetry(
  buildTzktQuery<TokensMetadataParams, TzktTokenData[]>(() => '/tokens', ['limit', 'offset', 'contract', 'tokenId'])
);

export const tokensMetadataProvider = new DataProvider(24 * 3600 * 1000, async (address?: string, token_id?: number) =>
  makeTokensQuery({
    contract: address,
    tokenId: token_id
  })
);

export const getTzktTransactionsByHash = withTzktRetry(
  buildTzktQuery<TransactionsByHashParams, TzktTransaction[]>(
    ({ hash }) => `/operations/transactions/${encodeURIComponent(hash)}`,
    undefined,
    { timeout: TZKT_REQUEST_TIMEOUT_MS }
  )
);

export const getTzktTokenTransfers = withTzktRetry(
  buildTzktQuery<TokenTransfersParams, TzktTokenTransfer[]>(
    () => '/tokens/transfers',
    ({ level, contract, tokenId, limit, offset }) => ({
      'level.eq': level,
      'token.contract': contract,
      'token.tokenId': tokenId,
      limit,
      offset
    }),
    { timeout: TZKT_REQUEST_TIMEOUT_MS }
  )
);

export const getTzktTokenBalances = withTzktRetry(
  buildTzktQuery<TokenBalancesParams, TzktTokenBalance[]>(
    () => '/tokens/balances',
    ({ account, contract }) => ({
      account,
      'token.contract': contract
    })
  )
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
