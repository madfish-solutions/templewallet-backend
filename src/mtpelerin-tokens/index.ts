import { parse } from 'node-html-parser';

import { redisClient } from '../redis';
import { safePromiseAll } from '../utils/helpers';
import logger from '../utils/logger';
import SingleQueryDataProvider from '../utils/SingleQueryDataProvider';

import { mtPelerinCurrenciesUrl } from './common';
import { fetchCryptoTokenMetadata, MtPelerinToken, parseCryptoTokens } from './crypto';
import { MtPelerinFiatCurrency, parseFiatCurrencies } from './fiat';

const MTPelerinCurrenciesStorageKey = 'mtpelerin-currencies';
const MTPelerinTokensRefreshInterval = 60 * 60 * 1000;

interface MtPelerinAssetsResponse {
  timestamp: number;
  cryptoTokens: MtPelerinToken[];
  fiatCurrencies: MtPelerinFiatCurrency[];
}

const fetchAssets = async (): Promise<Omit<MtPelerinAssetsResponse, 'timestamp'>> => {
  const [currenciesResponse, cryptoTokenMetadata] = await safePromiseAll([
    fetch(mtPelerinCurrenciesUrl),
    fetchCryptoTokenMetadata()
  ]);

  if (!currenciesResponse.ok) {
    throw new Error(`Mt Pelerin returned status ${currenciesResponse.status}`);
  }

  logger.info('Parsing HTML');
  const root = parse(await currenciesResponse.text());
  const assets = {
    cryptoTokens: parseCryptoTokens(root, cryptoTokenMetadata),
    fiatCurrencies: parseFiatCurrencies(root)
  };
  logger.info('Assets parsed');

  return assets;
};

const readStoredResponse = async (): Promise<MtPelerinAssetsResponse | null> => {
  const storedResponse = await redisClient.get(MTPelerinCurrenciesStorageKey);

  return storedResponse !== null ? JSON.parse(storedResponse) : null;
};

const updateMTPelerinAssets = async (): Promise<MtPelerinAssetsResponse> => {
  const timestamp = Date.now();
  const response = {
    timestamp,
    ...(await fetchAssets())
  };

  await redisClient.set(MTPelerinCurrenciesStorageKey, JSON.stringify(response));

  return response;
};

let mtPelerinTokensProvider: SingleQueryDataProvider<MtPelerinAssetsResponse> | undefined;

export const startMTPelerinAssetsUpdater = () => {
  mtPelerinTokensProvider ??= new SingleQueryDataProvider(MTPelerinTokensRefreshInterval, updateMTPelerinAssets);
};

export const getMTPelerinAssets = async (): Promise<MtPelerinAssetsResponse> => {
  const storedResponse = await readStoredResponse();
  if (storedResponse === null) {
    throw new Error('Unable to retrieve supported assets');
  }

  return storedResponse;
};
