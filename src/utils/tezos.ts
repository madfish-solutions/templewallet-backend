import { compose, MichelCodecPacker, Signer, TezosToolkit } from '@taquito/taquito';
import { tzip12 } from '@taquito/tzip12';
import { tzip16 } from '@taquito/tzip16';
import axios, { AxiosError } from 'axios';
import memoizee from 'memoizee';

import { ITicker } from '../interfaces/ticker.interface';
import { isDefined } from './helpers';
import logger from './logger';
import SingleQueryDataProvider from './SingleQueryDataProvider';
import { BcdTokenData } from './tzkt';

const RPC_URL = process.env.RPC_URL ?? 'https://mainnet-node.madfish.solutions';
const TEMPLE_WALLET_LV_ACCOUNT_PKH = 'tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A';
const TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY = 'edpkvWbk81uh1DEvdWKR4g1bjyTGhdu1mDvznPUFE2zDwNsLXrEb9K';

class LambdaViewSigner implements Signer {
  async publicKeyHash() {
    return TEMPLE_WALLET_LV_ACCOUNT_PKH;
  }

  async publicKey() {
    return TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY;
  }

  async secretKey(): Promise<string> {
    throw new Error('Secret key cannot be exposed');
  }

  async sign(): Promise<{
    bytes: string;
    sig: string;
    prefixSig: string;
    sbytes: string;
  }> {
    throw new Error('Cannot sign');
  }
}

const lambdaSigner = new LambdaViewSigner();
const michelEncoder = new MichelCodecPacker();
export const tezosToolkit = new TezosToolkit(RPC_URL);
tezosToolkit.setSignerProvider(lambdaSigner);
tezosToolkit.setPackerProvider(michelEncoder);

const getContract = memoizee((address: string) => tezosToolkit.contract.at(address), { promise: true });

export const getStorage = memoizee(
  async <T>(contractAddress: string) => {
    const contract = await getContract(contractAddress);

    return contract.storage<T>();
  },
  { promise: true, maxAge: 30000 }
);

const getTezExchangeRate = async () => {
  try {
    const { data } = await axios.get<ITicker>('https://api.binance.com/api/v3/ticker/price?symbol=XTZUSDT');

    return Number(data.price);
  } catch (e) {
    if (!(e instanceof AxiosError)) {
      logger.error('Request for TEZ exchange rate failed with unknown error');
    } else if (isDefined(e.response) && isDefined(e.response.data)) {
      logger.error(
        `Request for TEZ exchange rate failed with status ${e.response.status} and message ${e.response.data}`
      );
    } else if (isDefined(e.response) && isDefined(e.response.status)) {
      logger.error(`Request for TEZ exchange rate failed with status ${e.response.status}`);
    } else {
      logger.error('Request for TEZ exchange rate failed without response');
    }

    throw e;
  }
};

export const tezExchangeRateProvider = new SingleQueryDataProvider(60000, getTezExchangeRate);

export class MetadataParseError extends Error {}

export const getTokenMetadata = memoizee(
  async (tokenAddress: string, tokenId?: number): Promise<BcdTokenData> => {
    const contract = await tezosToolkit.wallet.at(tokenAddress, compose(tzip12, tzip16));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tokenData: any;
    let latestErrMessage;

    /**
     * Try fetch token data with TZIP12
     */
    try {
      tokenData = await contract.tzip12().getTokenMetadata(tokenId ?? 0);
    } catch (err) {
      latestErrMessage = (err as Error).message;
    }

    /**
     * Try fetch token data with TZIP16
     * Get them from plain tzip16 structure/scheme
     */
    if (tokenData === undefined || Object.keys(tokenData).length === 0) {
      try {
        const { metadata } = await contract.tzip16().getMetadata();
        tokenData = metadata;
      } catch (err) {
        latestErrMessage = (err as Error).message;
      }
    }

    if (tokenData === undefined) {
      throw new MetadataParseError(latestErrMessage ?? 'Unknown error');
    }

    let symbol: string, name: string;

    if (Boolean(tokenData.symbol)) {
      symbol = tokenData.symbol;
    } else {
      symbol = Boolean(tokenData.name) ? tokenData.name.substr(0, 8) : '???';
    }

    if (Boolean(tokenData.name)) {
      name = tokenData.name;
    } else if (Boolean(tokenData.symbol)) {
      name = tokenData.symbol;
    } else {
      name = 'Unknown Token';
    }

    return {
      name,
      symbol,
      decimals: Boolean(tokenData) ? +tokenData.decimals : 0,
      contract: tokenAddress,
      token_id: tokenId ?? 0,
      network: 'mainnet'
    };
  },
  { promise: true }
);
