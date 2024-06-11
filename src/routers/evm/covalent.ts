import { ChainID, CovalentClient } from '@covalenthq/client-sdk';
import retry from 'async-retry';

import { EnvVars } from '../../config';
import { CodedError } from '../../utils/errors';

const client = new CovalentClient(EnvVars.COVALENT_API_KEY, { enableRetry: false, threadCount: 10 });

const RETRY_OPTIONS = { maxRetryTime: 30_000 };

export const getEvmBalances = async (walletAddress: string, chainId: string) =>
  await retry(
    async () =>
      client.BalanceService.getTokenBalancesForWalletAddress(Number(chainId) as ChainID, walletAddress, {
        nft: true,
        noNftAssetMetadata: true,
        quoteCurrency: 'USD',
        noSpam: false
      }).then(({ data, error, error_message, error_code }) => {
        if (error) {
          throw new CodedError(Number(error_code) || 500, error_message);
        }

        return data;
      }),
    RETRY_OPTIONS
  );

export const getEvmTokensMetadata = async (walletAddress: string, chainId: string) =>
  await retry(
    async () =>
      client.BalanceService.getTokenBalancesForWalletAddress(Number(chainId) as ChainID, walletAddress, {
        nft: false,
        quoteCurrency: 'USD',
        noSpam: false
      }).then(({ data, error, error_message, error_code }) => {
        if (error) {
          throw new CodedError(Number(error_code) || 500, error_message);
        }

        return data;
      }),
    RETRY_OPTIONS
  );

const CHAIN_IDS_WITHOUT_CACHE_SUPPORT = [10, 11155420, 43114, 43113];

export const getEvmCollectiblesMetadata = async (walletAddress: string, chainId: string) => {
  const withUncached = CHAIN_IDS_WITHOUT_CACHE_SUPPORT.includes(Number(chainId));

  return await retry(
    async () =>
      client.NftService.getNftsForAddress(Number(chainId) as ChainID, walletAddress, {
        withUncached,
        noSpam: false
      }).then(({ data, error, error_message, error_code }) => {
        if (error) {
          throw new CodedError(Number(error_code) || 500, error_message);
        }

        return data;
      }),
    RETRY_OPTIONS
  );
};

export const getStringifiedResponse = (response: any) =>
  JSON.stringify(response, (_, value) => (typeof value === 'bigint' ? value.toString() : value));
