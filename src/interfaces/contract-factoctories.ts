import { MichelsonMap } from '@taquito/taquito';
import { BigNumber } from 'bignumber.js';

export type TokenListValue = [string, BigNumber];
export type TokenToExchangeKey = [string, BigNumber];
type UserRewardsValue = {
  reward: BigNumber;
  reward_paid: BigNumber;
};
type VotersValue = {
  candidate?: string;
  last_veto: string;
  veto: BigNumber;
  vote: BigNumber;
};

type LedgerValue = {
  allowances: Set<string>;
  balance: BigNumber;
  frozen_balance: BigNumber;
};

export type BigMapKeyType = string | number | object;

export interface BigMap<Key extends BigMapKeyType, Value> {
  get(keyToEncode: Key, block?: number): Promise<Value | undefined>;
  getMultipleValues(
    keysToEncode: Array<Key>,
    block?: number,
    batchSize?: number
  ): Promise<MichelsonMap<BigMapKeyType, Value | undefined>>;
  toJSON(): string;
  toString(): string;
}

export interface IContractFactoryStorage {
  counter: BigNumber;
  ledger: BigMap<string, LedgerValue>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: BigMap<string, any>;
  token_list: BigMap<BigNumber, TokenListValue>;
  token_to_exchange: BigMap<TokenToExchangeKey, string>;
  user_rewards: BigMap<string, UserRewardsValue>;
  vetos: BigMap<string, string>;
  voters: BigMap<string, VotersValue>;
  votes: BigMap<string, BigNumber>;
}
