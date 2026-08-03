import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { redisClient } from '../redis';
import { getEnv } from '../utils/env';
import { safePromiseAll } from '../utils/helpers';
import SingleQueryDataProvider from '../utils/SingleQueryDataProvider';

import { mtPelerinCurrenciesUrl } from './common';
import { fetchCryptoTokenMetadata, MtPelerinToken } from './crypto';
import { MtPelerinFiatCurrency } from './fiat';

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

  const html = await currenciesResponse.text();
  const assets = await new Promise<{ cryptoTokens: MtPelerinToken[]; fiatCurrencies: MtPelerinFiatCurrency[] }>(
    (res, rej) => {
      const worker = new Worker(
        path.join(__dirname, `parse-worker.${getEnv('NODE_ENV') === 'development' ? 'ts' : 'js'}`),
        { workerData: { html, cryptoTokenMetadata } }
      );

      worker.on('message', res);
      worker.on('error', rej);
      worker.on('exit', code => {
        if (code !== 0) {
          rej(new Error(`Parse worker exited with code ${code}`));
        }
      });
    }
  );

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
