import { Schema } from '@taquito/michelson-encoder';
import BigNumber from 'bignumber.js';

import { tezExchangeRateProvider } from './coingecko';
import { isDefined, withErrorLogging } from './helpers';
import SingleQueryDataProvider from './SingleQueryDataProvider';
import { tezosToolkit } from './tezos';
import { getExchangeRates } from './tokens';

const liquidityBakingStorageSchema = new Schema({
  prim: 'pair',
  args: [
    { prim: 'nat', annots: ['%tokenPool'] },
    {
      prim: 'pair',
      args: [
        { prim: 'mutez', annots: ['%xtzPool'] },
        {
          prim: 'pair',
          args: [
            { prim: 'nat', annots: ['%lqtTotal'] },
            {
              prim: 'pair',
              args: [
                { prim: 'address', annots: ['%tokenAddress'] },
                { prim: 'address', annots: ['%lqtAddress'] }
              ]
            }
          ]
        }
      ]
    }
  ]
});

const LIQUIDITY_BAKING_DEX_ADDRESS = 'KT1TxqZ8QtKvLu3V3JH7Gx58n7Co8pgtpQU5';

export const liquidityBakingStatsProvider = new SingleQueryDataProvider(
  60000,
  withErrorLogging(async () => {
    const exchangeRates = await getExchangeRates();
    const tzbtcEntry = exchangeRates.find(
      ({ metadata }) => metadata?.contract === 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn'
    );
    const { data: tezExchangeRate } = await tezExchangeRateProvider.getState();
    const [rawContractStorage, { liquidity_baking_subsidy }, { hash, level, timestamp }] = await Promise.all([
      tezosToolkit.rpc.getStorage(LIQUIDITY_BAKING_DEX_ADDRESS),
      tezosToolkit.rpc.getConstants(),
      tezosToolkit.rpc.getBlockHeader()
    ]);
    const { xtzPool, tokenPool, lqtTotal } = liquidityBakingStorageSchema.Execute(rawContractStorage);

    const dailyDistributionAtomic = new BigNumber(liquidity_baking_subsidy).times(60 * 24);
    const dailyDistribution = new BigNumber(dailyDistributionAtomic).shiftedBy(-6);
    const annualSubsidy = dailyDistributionAtomic.times(365);

    let tvlInUsd: BigNumber | null = null;
    if (isDefined(tezExchangeRate) && isDefined(tzbtcEntry?.metadata)) {
      const tezosPoolInTokens = new BigNumber(xtzPool).shiftedBy(-6);
      const tzBtcPoolInTokens = new BigNumber(tokenPool).shiftedBy(-tzbtcEntry.metadata.decimals);
      tvlInUsd = tezosPoolInTokens.times(tezExchangeRate).plus(tzBtcPoolInTokens.times(tzbtcEntry.exchangeRate));
    }
    const depositExchangeRate = isDefined(tvlInUsd) && lqtTotal.isGreaterThan(0) ? tvlInUsd.div(lqtTotal) : null;

    return {
      stats: {
        contractAddress: LIQUIDITY_BAKING_DEX_ADDRESS,
        apr: xtzPool.plus(annualSubsidy).div(xtzPool).minus(1).div(2).times(100).toFixed(),
        depositExchangeRate: depositExchangeRate?.toFixed() ?? null,
        dailyDistribution: dailyDistribution.toFixed(),
        dailyDistributionDollarEquivalent: isDefined(tezExchangeRate)
          ? dailyDistribution.times(tezExchangeRate).toFixed()
          : '0',
        earnExchangeRate: tezExchangeRate?.toString() ?? null,
        vestingPeriodSeconds: '0',
        staked: lqtTotal.toFixed(),
        tvlInUsd: tvlInUsd?.toFixed() ?? null,
        tvlInStakedToken: lqtTotal.toFixed()
      },
      blockInfo: {
        hash,
        level,
        timestamp
      }
    };
  }, 'Failed to fetch liquidity baking stats'),
  undefined,
  300000
);
