import {
  BailoutPool,
  contracts,
  AssetDefinition,
  createEngine,
  Storage,
  StorageKey,
  StorageKeyReturnType,
  UnifiedStaking,
  mainnetTokens,
  mainnetNetworkConstants
} from '@temple-wallet/youves-sdk';
import BigNumber from 'bignumber.js';

import SingleQueryDataProvider from './SingleQueryDataProvider';
import { tezosToolkit as tezos } from './tezos';
import { getExchangeRates } from './tokens';

const YOUVES_INDEXER_URL = 'https://indexer.youves.com/v1/graphql';
const INDEXER_CONFIG = { url: YOUVES_INDEXER_URL, headCheckUrl: '' };
const MULTIPLIER = 100;
const ubtcToken = contracts.mainnet.find(token => token.id === 'uBTC')!;
const uusdToken = contracts.mainnet.find(token => token.id === 'uUSD')!;
const youToken = mainnetTokens.youToken;

class MemoryStorage implements Storage {
  public storage: Map<string, any>;

  constructor() {
    this.storage = new Map();
  }
  public async set<K extends StorageKey>(key: K, value: StorageKeyReturnType[K]): Promise<void> {
    this.storage.set(key, value);
  }
  public async get<K extends StorageKey>(key: K): Promise<StorageKeyReturnType[K]> {
    return this.storage.get(key);
  }
  public async delete<K extends StorageKey>(key: K): Promise<void> {
    this.storage.delete(key);
  }
  public async clear() {
    this.storage.clear();
  }
}

const unifiedStaking = new UnifiedStaking(tezos, INDEXER_CONFIG, mainnetNetworkConstants);
const bailoutPool = new BailoutPool(tezos, INDEXER_CONFIG, mainnetNetworkConstants);

const createLocalEngine = (token: AssetDefinition) =>
  createEngine({
    tezos,
    contracts: token,
    storage: new MemoryStorage(),
    indexerConfig: INDEXER_CONFIG,
    tokens: mainnetTokens,
    activeCollateral: token.collateralOptions[0],
    networkConstants: mainnetNetworkConstants
  });

const withToPercentage =
  <A extends unknown[]>(fn: (...args: A) => Promise<BigNumber>) =>
  async (...args: A) => {
    const rawApr = await fn(...args);

    return Number(rawApr.multipliedBy(MULTIPLIER));
  };

const getV2YOUTokenApr = withToPercentage((assetToUsdExchangeRate: BigNumber, governanceToUsdExchangeRate: BigNumber) =>
  unifiedStaking.getAPR(assetToUsdExchangeRate, governanceToUsdExchangeRate)
);

const getV3YOUTokenApr = withToPercentage(() => bailoutPool.getAPR());

const getYouvesTokenApr = withToPercentage((token: AssetDefinition) =>
  createLocalEngine(token).getSavingsPoolV3YearlyInterestRate()
);

export const youvesStatsProvider = new SingleQueryDataProvider(60000, async () => {
  const exchangeRates = await getExchangeRates();
  const youToUsdExchangeRate = exchangeRates.find(
    rate => rate.tokenAddress === youToken.contractAddress && rate.tokenId === youToken.tokenId
  )!.exchangeRate;

  const aprResults = await Promise.all([
    Promise.all([
      getV2YOUTokenApr(youToUsdExchangeRate, youToUsdExchangeRate).then(value => ({ v2: value })),
      getV3YOUTokenApr().then(value => ({ v3: value }))
    ]),
    getYouvesTokenApr(ubtcToken),
    getYouvesTokenApr(uusdToken)
  ]);

  return {
    apr: Object.fromEntries(
      [youToken, ubtcToken, uusdToken].map((asset, index) => {
        const rawResult = aprResults[index];
        const { contractAddress, tokenId } = 'token' in asset ? asset.token : asset;

        return [
          `${contractAddress}_${tokenId}`,
          typeof rawResult === 'number' ? rawResult : Object.assign(...rawResult)
        ];
      })
    )
  };
});
