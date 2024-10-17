import {
  GoldRushClient,
  ChainID,
  GoldRushResponse,
  GetTransactionsForAddressV3QueryParamOpts
} from '@covalenthq/client-sdk';
import retry from 'async-retry';

import { EnvVars } from '../../config';
import { CodedError } from '../../utils/errors';

const client = new GoldRushClient(EnvVars.COVALENT_API_KEY, { enableRetry: false, threadCount: 10 });

const RETRY_OPTIONS: retry.Options = { maxRetryTime: 30_000 };

/** For v2 only for now. No support in v3. */
const ACTIVITIES_PER_PAGE = 30;

export const getEvmBalances = (walletAddress: string, chainId: string) =>
  retry(
    () =>
      client.BalanceService.getTokenBalancesForWalletAddress(Number(chainId) as ChainID, walletAddress, {
        nft: true,
        noNftAssetMetadata: true,
        quoteCurrency: 'USD',
        noSpam: false
      }).then(processGoldRushResponse),
    RETRY_OPTIONS
  );

export const getEvmTokensMetadata = (walletAddress: string, chainId: string) =>
  retry(
    () =>
      client.BalanceService.getTokenBalancesForWalletAddress(Number(chainId) as ChainID, walletAddress, {
        nft: false,
        quoteCurrency: 'USD',
        noSpam: false
      }).then(processGoldRushResponse),
    RETRY_OPTIONS
  );

const CHAIN_IDS_WITHOUT_CACHE_SUPPORT = [10, 11155420, 43114, 43113];

export const getEvmCollectiblesMetadata = async (walletAddress: string, chainId: string) => {
  const withUncached = CHAIN_IDS_WITHOUT_CACHE_SUPPORT.includes(Number(chainId));

  return await retry(
    () =>
      client.NftService.getNftsForAddress(Number(chainId) as ChainID, walletAddress, {
        withUncached,
        noSpam: false
      }).then(processGoldRushResponse),
    RETRY_OPTIONS
  );
};

export const getEvmAccountTransactions = (walletAddress: string, chainId: string, page?: number) =>
  retry(async () => {
    const options: GetTransactionsForAddressV3QueryParamOpts = {
      // blockSignedAtAsc: true,
      noLogs: false,
      quoteCurrency: 'USD',
      withSafe: false
    };

    const res = await (typeof page === 'number'
      ? client.TransactionService.getTransactionsForAddressV3(Number(chainId) as ChainID, walletAddress, page, options)
      : client.TransactionService.getAllTransactionsForAddressByPage(
          Number(chainId) as ChainID,
          walletAddress,
          options
        ));

    return processGoldRushResponse(res);
  }, RETRY_OPTIONS);

export const getEvmAccountERC20Transfers = (
  walletAddress: string,
  chainId: string,
  contractAddress: string,
  page?: number
) =>
  retry(async () => {
    const res = await client.BalanceService.getErc20TransfersForWalletAddressByPage(
      Number(chainId) as ChainID,
      walletAddress,
      {
        contractAddress,
        quoteCurrency: 'USD',
        pageNumber: page,
        pageSize: ACTIVITIES_PER_PAGE
      }
    );

    return processGoldRushResponse(res);
  }, RETRY_OPTIONS);

function processGoldRushResponse<T>({ data, error, error_message, error_code }: GoldRushResponse<T>) {
  if (error) {
    const code = error_code && Number.isSafeInteger(Number(error_code)) ? Number(error_code) : 500;

    throw new CodedError(code, error_message ?? 'Unknown error');
  }

  return JSON.stringify(data, (_, value) => (typeof value === 'bigint' ? value.toString() : value));
}
