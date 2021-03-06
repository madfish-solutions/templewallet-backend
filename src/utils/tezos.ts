import {
  compose,
  MichelCodecPacker,
  Signer,
  TezosToolkit,
} from "@taquito/taquito";
import { tzip12 } from "@taquito/tzip12";
import { tzip16 } from "@taquito/tzip16";
import memoizee from "memoizee";
import { BcdTokenData } from "./better-call-dev";
import fetch from "./fetch";
import SingleQueryDataProvider from "./SingleQueryDataProvider";

const MAINNET_RPC_URL = process.env.RPC_URL || "https://mainnet-node.madfish.solutions";
const TEMPLE_WALLET_LV_ACCOUNT_PKH = "tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A";
const TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY =
  "edpkvWbk81uh1DEvdWKR4g1bjyTGhdu1mDvznPUFE2zDwNsLXrEb9K";

class LambdaViewSigner implements Signer {
  async publicKeyHash() {
    return TEMPLE_WALLET_LV_ACCOUNT_PKH;
  }

  async publicKey() {
    return TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY;
  }

  async secretKey(): Promise<string> {
    throw new Error("Secret key cannot be exposed");
  }

  async sign(): Promise<{
    bytes: string;
    sig: string;
    prefixSig: string;
    sbytes: string;
  }> {
    throw new Error("Cannot sign");
  }
}

const lambdaSigner = new LambdaViewSigner();
const michelEncoder = new MichelCodecPacker();
const mainnetToolkit = new TezosToolkit(MAINNET_RPC_URL);
mainnetToolkit.setSignerProvider(lambdaSigner);
mainnetToolkit.setPackerProvider(michelEncoder);

const getContract = memoizee(
  (address: string) => mainnetToolkit.contract.at(address),
  { promise: true }
);

export const getStorage = memoizee(
  async (contractAddress: string) => {
    const contract = await getContract(contractAddress);
    return contract.storage<any>();
  },
  { promise: true, maxAge: 30000 }
);

const getTezExchangeRate = async () => {
  const marketTickers = await fetch<any>(
    "https://api.tzstats.com/markets/tickers"
  );
  const usdTickers = marketTickers.filter((e) => e.quote === "USD");
  // price index: use all USD ticker last prices with equal weight
  const vol = usdTickers.reduce((s, t) => s + t.volume_base, 0) || null;
  const price: number =
    vol && usdTickers.reduce((s, t) => s + (t.last * t.volume_base) / vol, 0);

  return price;
};

export const tezExchangeRateProvider = new SingleQueryDataProvider(
  30000,
  getTezExchangeRate
);

export class MetadataParseError extends Error {}

export const getTokenMetadata = memoizee(
  async (tokenAddress: string, tokenId?: number): Promise<BcdTokenData> => {
    const contract = await mainnetToolkit.wallet.at(
      tokenAddress,
      // @ts-ignore
      compose(tzip12, tzip16)
    );

    let tokenData: any;
    let latestErrMessage;

    /**
     * Try fetch token data with TZIP12
     */
    try {
      // @ts-ignore
      tokenData = await contract.tzip12().getTokenMetadata(tokenId ?? 0);
    }
    // @ts-ignore
    catch (err: Error) {
      latestErrMessage = err.message;
    }

    /**
     * Try fetch token data with TZIP16
     * Get them from plain tzip16 structure/scheme
     */
    if (!tokenData || Object.keys(tokenData).length === 0) {
      try {
        // @ts-ignore
        const { metadata } = await contract.tzip16().getMetadata();
        tokenData = metadata;
      }
      // @ts-ignore
      catch (err: Error) {
        latestErrMessage = err.message;
      }
    }

    if (!tokenData) {
      throw new MetadataParseError(latestErrMessage ?? "Unknown error");
    }

    return {
      decimals: tokenData.decimals ? +tokenData.decimals : 0,
      symbol:
        tokenData.symbol ||
        (tokenData.name ? tokenData.name.substr(0, 8) : "???"),
      name: tokenData.name || tokenData.symbol || "Unknown Token",
      contract: tokenAddress,
      token_id: tokenId ?? 0,
      network: "mainnet",
    };
  },
  { promise: true }
);
