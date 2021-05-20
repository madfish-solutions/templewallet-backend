import { MichelCodecPacker, Signer, TezosToolkit } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import memoizee from "memoizee";
import fetch from "./fetch";
//  const ReadOnlySigner = require("./ReadOnlySigner");
import SingleQueryDataProvider from "./SingleQueryDataProvider";

const MAINNET_RPC_URL = "https://mainnet.smartpy.io";
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

export const getTokenDescriptor = memoizee(
  async (
    exchangeContractAddress: string,
    contractType: "quipuswap" | "dexter"
  ): Promise<{ address: string; tokenId?: number }> => {
    const storage = await getStorage(exchangeContractAddress);
    if (contractType === "quipuswap") {
      const { token_address, token_id } = storage.storage;
      return {
        address: token_address,
        tokenId: token_id && token_id.toNumber(),
      };
    }
    return {
      address: storage.tokenAddress,
      tokenId: storage.tokenId && storage.tokenId.toNumber(),
    };
  },
  { promise: true }
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

const lambdaContractAddress = "KT1CPuTzwC7h7uLXd5WQmpMFso1HxrLBUtpE";
export const getBalance = async (
  pkh: string,
  tokenAddress?: string,
  tokenId?: number
) => {
  if (!tokenAddress) {
    return mainnetToolkit.rpc.getBalance(pkh);
  }
  const contract = await getContract(tokenAddress);
  if (contract.views.getBalance) {
    let nat: BigNumber | undefined;
    try {
      nat = await contract.views.getBalance(pkh).read(lambdaContractAddress);
    } catch {}
    if (!nat || nat.isNaN()) {
      return new BigNumber(0);
    }
    return nat;
  }
  if (contract.views.balance_of) {
    let nat: BigNumber | undefined;
    try {
      const response = await contract.views
        .balance_of([{ owner: pkh, token_id: tokenId }])
        .read(lambdaContractAddress);
      nat = response[0].balance;
    } catch {}
    if (!nat || nat.isNaN()) {
      return new BigNumber(0);
    }
    return nat;
  }
  throw new Error("Not Supported");
};
