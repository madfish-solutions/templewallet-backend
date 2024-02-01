import { BigNumber } from 'bignumber.js';
import { differenceBy, isEqual } from 'lodash';

import { redisClient } from '../redis';
import { blockFinder, EMPTY_BLOCK } from './block-finder';
import DataProvider from './DataProvider';
import { getRecentDestinations } from './get-recent-destinations';
import { isDefined } from './helpers';
import logger from './logger';
import PromisifiedSemaphore from './PromisifiedSemaphore';
import SingleQueryDataProvider from './SingleQueryDataProvider';
import { tezExchangeRateProvider } from './tezos';
import {
  getThreeRouteDexes,
  getThreeRouteSwap,
  getThreeRouteTokens,
  ThreeRouteStandardEnum,
  ThreeRouteFa12Token,
  ThreeRouteFa2Token,
  getChains,
  THREE_ROUTE_SIRS_SYMBOL,
  ThreeRouteSwapResponse,
  ThreeRouteDex
} from './three-route';
import { BcdTokenData, mapTzktTokenDataToBcdTokenData, tokensMetadataProvider } from './tzkt';

interface SwapsResponse {
  directSwap: ThreeRouteSwapResponse;
  invertedSwap: ThreeRouteSwapResponse;
  updatedAt: string;
}

interface TokenExchangeRateEntry {
  tokenAddress: string;
  tokenId?: number;
  exchangeRate: BigNumber;
  metadata?: BcdTokenData;
  swapsUpdatedAt?: string;
}

class TimeoutError extends Error {}

const tokensListProvider = new SingleQueryDataProvider(30000, () => getThreeRouteTokens({}));
const dexesListProvider = new SingleQueryDataProvider(30000, () => getThreeRouteDexes({}));

const THREE_ROUTE_TEZ_SYMBOL = 'XTZ';
const EMPTY_SWAP = {
  input: 0,
  output: 0,
  chains: []
};

const ASPENCOIN_ADDRESS = 'KT1S5iPRQ612wcNm6mXDqDhTNegGFcvTV7vM';

const EXCHANGE_RATES_STORAGE_KEY = 'exchange_rates';
const PREV_DEXES_LIST_STORAGE_KEY = 'prev_dexes_list';

const getToTezExchangeRatesVersions = ({ directSwap, invertedSwap }: SwapsResponse) => {
  const toTezExchangeRatesVersions: BigNumber[] = [];
  if (directSwap.output !== 0) {
    toTezExchangeRatesVersions.push(new BigNumber(directSwap.input).div(directSwap.output));
  }
  if (invertedSwap.output !== 0) {
    toTezExchangeRatesVersions.push(new BigNumber(invertedSwap.output).div(invertedSwap.input));
  }

  return toTezExchangeRatesVersions;
};

const assertSmallRatesDifference = (swapResponse: SwapsResponse) => {
  const toTezExchangeRatesVersions = getToTezExchangeRatesVersions(swapResponse);
  const minRate = BigNumber.min(...toTezExchangeRatesVersions);
  const maxRate = BigNumber.max(...toTezExchangeRatesVersions);
  if (minRate.div(maxRate).lt(0.9)) {
    throw new Error('Prices difference is too big');
  }
};

const getSwapsByTezAmount = async (outputTokenSymbol: string, tezAmount: number) => {
  const updatedAt = new Date().toISOString();
  const directSwap = await getThreeRouteSwap({
    inputTokenSymbol: THREE_ROUTE_TEZ_SYMBOL,
    outputTokenSymbol,
    realAmount: tezAmount
  });

  if (directSwap.output === 0) {
    throw new Error('Failed to get direct swap');
  }

  const invertedSwap = await getThreeRouteSwap({
    inputTokenSymbol: outputTokenSymbol,
    outputTokenSymbol: THREE_ROUTE_TEZ_SYMBOL,
    realAmount: directSwap.output
  });

  const response = { directSwap, invertedSwap, updatedAt };
  assertSmallRatesDifference(response);

  return response;
};

const getSwapsByOneToken = async (outputTokenSymbol: string) => {
  const updatedAt = new Date().toISOString();
  const invertedSwap = await getThreeRouteSwap({
    inputTokenSymbol: outputTokenSymbol,
    outputTokenSymbol: THREE_ROUTE_TEZ_SYMBOL,
    realAmount: 1
  });

  if (invertedSwap.output === 0) {
    throw new Error(`Failed to get swaps for 1 ${outputTokenSymbol}`);
  }

  return { directSwap: EMPTY_SWAP, invertedSwap, updatedAt };
};

const getSwaps = async (outputTokenSymbol: string) => {
  try {
    return await getSwapsByTezAmount(outputTokenSymbol, 10);
  } catch {}

  try {
    return await getSwapsByTezAmount(outputTokenSymbol, 1);
  } catch {}

  try {
    return await getSwapsByOneToken(outputTokenSymbol);
  } catch {
    return { directSwap: EMPTY_SWAP, invertedSwap: EMPTY_SWAP, updatedAt: new Date().toISOString() };
  }
};

const probeSwapsProvider = new DataProvider(Infinity, getSwaps);

const rejectOnTimeout = (timeoutMs: number) =>
  new Promise<never>((_, rej) => setTimeout(() => rej(new TimeoutError()), timeoutMs));

tokensMetadataProvider.subscribe(ASPENCOIN_ADDRESS);

const getTokensExchangeRates = async (): Promise<TokenExchangeRateEntry[]> => {
  logger.info('Getting tokens exchange rates...');
  logger.info('Getting exchange rates of tokens which are known to 3route...');
  const { data: tokens, error: tokensError } = await tokensListProvider.getState();
  const { data: tezExchangeRate, error: tezExchangeRateError } = await tezExchangeRateProvider.getState();

  if (tokensError ?? tezExchangeRateError) {
    throw tokensError ?? tezExchangeRateError;
  }

  const exchangeRatesWithHoles = await Promise.all(
    tokens
      .filter(
        (token): token is ThreeRouteFa12Token | ThreeRouteFa2Token => token.standard !== ThreeRouteStandardEnum.xtz
      )
      .map(async (token): Promise<TokenExchangeRateEntry | undefined> => {
        const { contract, tokenId: rawTokenId } = token;
        const tokenId = isDefined(rawTokenId) ? Number(rawTokenId) : undefined;
        await probeSwapsProvider.subscribe(token.symbol);
        try {
          const { data: probeSwaps, error: swapError } = await Promise.race([
            probeSwapsProvider.get(token.symbol),
            rejectOnTimeout(10000)
          ]);
          await tokensMetadataProvider.subscribe(contract, tokenId);
          const { data: metadata } = await tokensMetadataProvider.get(contract, tokenId);

          if (swapError) {
            logger.error(`Failed to get exchange rate for token ${token.symbol}`);
            throw swapError;
          }

          const toTezExchangeRatesVersions = getToTezExchangeRatesVersions(probeSwaps);
          const exchangeRate =
            toTezExchangeRatesVersions.length === 0
              ? new BigNumber(0)
              : BigNumber.sum(...toTezExchangeRatesVersions)
                  .div(toTezExchangeRatesVersions.length)
                  .times(tezExchangeRate);

          return {
            tokenAddress: contract,
            tokenId,
            exchangeRate,
            metadata: mapTzktTokenDataToBcdTokenData(metadata?.[0]),
            swapsUpdatedAt: probeSwaps.updatedAt
          };
        } catch (e) {
          if (e instanceof TimeoutError) {
            logger.error(`Timeout error while getting exchange rate for token ${token.symbol}`);

            return undefined;
          }

          throw e;
        }
      })
  );

  const exchangeRates = exchangeRatesWithHoles.filter(isDefined);

  logger.info('Successfully got tokens exchange rates');

  return [...exchangeRates].filter(({ exchangeRate }) => !exchangeRate.eq(0));
};

const tokensExchangeRatesProvider = new SingleQueryDataProvider(60000, getTokensExchangeRates);

export const getExchangeRatesFromDB = async (): Promise<TokenExchangeRateEntry[]> => {
  const rawValue = await redisClient.get(EXCHANGE_RATES_STORAGE_KEY);

  return JSON.parse(rawValue ?? '[]');
};

const updateExchangeRatesInDB = async () => {
  const prevExchangeRates = await getExchangeRatesFromDB();
  const prevIndexedExchangeRates = Object.fromEntries(
    prevExchangeRates.map(exchangeRate => [`${exchangeRate.tokenAddress}_${exchangeRate.tokenId}`, exchangeRate])
  );
  const { data: exchangeRatesUpdates, error: exchangeRatesError } = await tokensExchangeRatesProvider.getState();

  if (exchangeRatesError) {
    return;
  }

  const indexedExchangeRatesUpdates = Object.fromEntries(
    exchangeRatesUpdates.map(exchangeRate => [`${exchangeRate.tokenAddress}_${exchangeRate.tokenId}`, exchangeRate])
  );

  const newExchangeRates = Object.values({
    ...prevIndexedExchangeRates,
    ...indexedExchangeRatesUpdates
  });

  await redisClient.set(EXCHANGE_RATES_STORAGE_KEY, JSON.stringify(newExchangeRates));
};
updateExchangeRatesInDB().catch(logger.error);

const getPrevDexesList = async (): Promise<ThreeRouteDex[] | null> => {
  const rawValue = await redisClient.get(PREV_DEXES_LIST_STORAGE_KEY);

  return isDefined(rawValue) ? JSON.parse(rawValue) : null;
};

const setPrevDexesList = async (dexesList: ThreeRouteDex[]) =>
  redisClient.set(PREV_DEXES_LIST_STORAGE_KEY, JSON.stringify(dexesList));

const swapsUpdateSemaphore = new PromisifiedSemaphore();
blockFinder(EMPTY_BLOCK, async block =>
  swapsUpdateSemaphore.exec(async () => {
    logger.info(`updating stats for level ${block.header.level}`);
    const recentDestinations = await getRecentDestinations(block.header.level);
    const { data: tokens, error: tokensError } = await tokensListProvider.getState();
    const { data: dexes, error: dexesError } = await dexesListProvider.getState();

    if (tokensError ?? dexesError) {
      throw tokensError ?? dexesError;
    }

    let dexesListChanged = false;
    const prevDexesList = await getPrevDexesList();
    if (prevDexesList) {
      const createdOrUpdatedDexesList = differenceBy(dexes, prevDexesList, isEqual);
      const deletedOrUpdatedDexesList = differenceBy(prevDexesList, dexes, isEqual);
      dexesListChanged = createdOrUpdatedDexesList.length > 0 || deletedOrUpdatedDexesList.length > 0;
    }
    await setPrevDexesList(dexes);

    if (dexesListChanged) {
      logger.info('dexes list changed, refreshing all tokens exchange rates');
    }

    const outputsUpdatesFlags = await Promise.all(
      tokens.map(async token => {
        if (token.symbol === THREE_ROUTE_TEZ_SYMBOL) {
          return false;
        }

        if (dexesListChanged || token.symbol === THREE_ROUTE_SIRS_SYMBOL) {
          // Swap output for SIRS should be updated each block because of baking subsidy
          await probeSwapsProvider.refetchInSubscription(token.symbol);

          return true;
        }

        try {
          await probeSwapsProvider.subscribe(token.symbol);
          const { data: probeSwaps, error: swapError } = await Promise.race([
            probeSwapsProvider.get(token.symbol),
            rejectOnTimeout(10000)
          ]);

          if (swapError) {
            throw swapError;
          }

          const { directSwap, invertedSwap } = probeSwaps;
          const directSwapChains = getChains(directSwap);
          const invertedSwapChains = getChains(invertedSwap);

          if (directSwapChains.length === 0) {
            logger.info(`updating swap output for token ${token.symbol} because of direct swap chains absence`);
            await probeSwapsProvider.refetchInSubscription(token.symbol);

            return true;
          }

          const dexesAddresses = directSwapChains
            .concat(invertedSwapChains)
            .map(chain => chain.hops.map(hop => dexes.find(dex => dex.id === hop.dex)?.contract).filter(isDefined))
            .flat();

          const firstUpdatedDexAddress = dexesAddresses.find(dexAddress => recentDestinations.includes(dexAddress));
          if (isDefined(firstUpdatedDexAddress)) {
            logger.info(`updating swap output for token ${token.symbol} because of dex ${firstUpdatedDexAddress}`);
            await probeSwapsProvider.refetchInSubscription(token.symbol);

            return true;
          }

          return false;
        } catch (e) {
          logger.error(e as Error);

          return false;
        }
      })
    );
    if (outputsUpdatesFlags.some(flag => flag)) {
      logger.info('refreshing tokens exchange rates because of swaps outputs updates');
      await tokensExchangeRatesProvider.refetch();
      await updateExchangeRatesInDB();
    }
    logger.info(`stats updated for level ${block.header.level}`);
  })
);
