import { BigNumber } from 'bignumber.js';

import { IPriceHistory } from '../interfaces/price-history';
import { blockFinder, EMPTY_BLOCK } from './block-finder';
import DataProvider from './DataProvider';
import fetch from './fetch';
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
  ThreeRouteFa2Token
} from './three-route';
import { BcdTokenData, mapTzktTokenDataToBcdTokenData, tokensMetadataProvider } from './tzkt';

const tokensListProvider = new SingleQueryDataProvider(30000, () => getThreeRouteTokens({}));
const dexesListProvider = new SingleQueryDataProvider(30000, () => getThreeRouteDexes({}));

const THREE_ROUTE_TEZ_SYMBOL = 'XTZ';
const PROBE_TEZ_AMOUNT = 10;
const probeSwapsProvider = new DataProvider(Infinity, async (outputTokenSymbol: string) => {
  const directSwap = await getThreeRouteSwap({
    inputTokenSymbol: THREE_ROUTE_TEZ_SYMBOL,
    outputTokenSymbol,
    realAmount: PROBE_TEZ_AMOUNT
  });

  if (directSwap.output === 0) {
    return {
      directSwap,
      invertedSwap: {
        input: 0,
        output: 0,
        chains: []
      }
    };
  }

  const invertedSwap = await getThreeRouteSwap({
    inputTokenSymbol: outputTokenSymbol,
    outputTokenSymbol: THREE_ROUTE_TEZ_SYMBOL,
    realAmount: directSwap.output
  });

  return { directSwap, invertedSwap };
});

export class TimeoutError extends Error {}

export type TokenExchangeRateEntry = {
  tokenAddress: string;
  tokenId?: number;
  exchangeRate: BigNumber;
  metadata?: BcdTokenData;
};

export const ASPENCOIN_ADDRESS = 'KT1S5iPRQ612wcNm6mXDqDhTNegGFcvTV7vM';
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
        logger.info(`Getting exchange rate for ${token.symbol}`);
        const { contract, tokenId: rawTokenId } = token;
        const tokenId = isDefined(rawTokenId) ? Number(rawTokenId) : undefined;
        await probeSwapsProvider.subscribe(token.symbol);
        try {
          const { data: probeSwaps, error: swapError } = await Promise.race([
            probeSwapsProvider.get(token.symbol),
            new Promise<never>((_, rej) => setTimeout(() => rej(new TimeoutError()), 10000))
          ]);
          await tokensMetadataProvider.subscribe(contract, tokenId);
          const { data: metadata } = await tokensMetadataProvider.get(contract, tokenId);

          if (swapError) {
            logger.error(`Failed to get exchange rate for token ${token.symbol}`);
            throw swapError;
          }

          const { directSwap, invertedSwap } = probeSwaps;
          const toTezExchangeRatesVersions: BigNumber[] = [];
          if (directSwap.output !== 0) {
            toTezExchangeRatesVersions.push(new BigNumber(PROBE_TEZ_AMOUNT).div(directSwap.output));
          }
          if (invertedSwap.output !== 0) {
            toTezExchangeRatesVersions.push(new BigNumber(invertedSwap.output).div(invertedSwap.input));
          }
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
            metadata: mapTzktTokenDataToBcdTokenData(metadata?.[0])
          };
        } catch (e) {
          if (e instanceof TimeoutError) {
            console.error('Timeout error while getting exchange rate for token', token.symbol);

            return undefined;
          }

          throw e;
        }
      })
  );

  const exchangeRates = exchangeRatesWithHoles.filter(isDefined);

  if (!exchangeRates.some(({ tokenAddress }) => tokenAddress === ASPENCOIN_ADDRESS)) {
    logger.info('Getting exchange rate for Aspencoin');
    try {
      const { data: aspencoinMetadata, error: aspencoinMetadataError } = await tokensMetadataProvider.get(
        ASPENCOIN_ADDRESS
      );
      if (aspencoinMetadataError) {
        throw aspencoinMetadataError;
      }
      const priceHistory = await fetch<IPriceHistory>(
        'https://gateway-web-markets.tzero.com/mdt/public-pricehistory/ASPD?page=1'
      );
      const latestValidEntry = priceHistory.priceHistories.find(({ close }) => close !== null);
      const tokenPrice = latestValidEntry ? new BigNumber(latestValidEntry.close ?? 0) : new BigNumber(0);

      exchangeRates.push({
        tokenAddress: ASPENCOIN_ADDRESS,
        tokenId: undefined,
        exchangeRate: tokenPrice,
        metadata: mapTzktTokenDataToBcdTokenData(aspencoinMetadata?.[0])
      });
    } catch (e) {}
  }

  logger.info('Successfully got tokens exchange rates');

  return [...exchangeRates].filter(({ exchangeRate }) => !exchangeRate.eq(0));
};

export const tokensExchangeRatesProvider = new SingleQueryDataProvider(60000, getTokensExchangeRates);

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

    const outputsUpdatesFlags = await Promise.all(
      tokens.map(async token => {
        if (token.symbol === THREE_ROUTE_TEZ_SYMBOL) {
          return false;
        }

        await probeSwapsProvider.subscribe(token.symbol);
        const { data: probeSwaps, error: swapError } = await probeSwapsProvider.get(token.symbol);

        if (swapError) {
          throw swapError;
        }

        const { directSwap, invertedSwap } = probeSwaps;
        const dexesAddresses = directSwap.chains
          .concat(invertedSwap.chains)
          .map(chain => chain.hops.map(hop => dexes.find(dex => dex.id === hop.dex)?.contract).filter(isDefined))
          .flat();

        const firstUpdatedDexAddress = dexesAddresses.find(dexAddress => recentDestinations.includes(dexAddress));
        if (isDefined(firstUpdatedDexAddress)) {
          logger.info(`updating swap output for token ${token.symbol} because of dex ${firstUpdatedDexAddress}`);
          await probeSwapsProvider.refetchInSubscription(token.symbol);

          return true;
        }

        return false;
      })
    );
    if (outputsUpdatesFlags.some(flag => flag)) {
      logger.info('refreshing tokens exchange rates because of swaps outputs updates');
      await tokensExchangeRatesProvider.refetch();
    }
    logger.info(`stats updated for level ${block.header.level}`);
  })
);
