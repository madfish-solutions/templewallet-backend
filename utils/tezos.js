const { MichelCodecPacker, TezosToolkit } = require("@taquito/taquito");
const tzip12 = require("@taquito/tzip12");
const { default: BigNumber } = require("bignumber.js");
const memoizee = require("memoizee");
const { fetch } = require("./fetch");
const SingleQueryDataProvider = require("./SingleQueryDataProvider");

const MAINNET_RPC_URL = "https://mainnet.smartpy.io";
const TEMPLE_WALLET_LV_ACCOUNT_PKH = "tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A";
const TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY =
  "edpkvWbk81uh1DEvdWKR4g1bjyTGhdu1mDvznPUFE2zDwNsLXrEb9K";
class LambdaViewSigner {
  async publicKeyHash() {
    return TEMPLE_WALLET_LV_ACCOUNT_PKH;
  }

  async publicKey() {
    return TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY;
  }

  async secretKey() {
    throw new Error("Secret key cannot be exposed");
  }

  async sign() {
    throw new Error("Cannot sign");
  }
}

const lambdaSigner = new LambdaViewSigner();
const michelEncoder = new MichelCodecPacker();
const mainnetToolkit = new TezosToolkit(MAINNET_RPC_URL);
mainnetToolkit.setSignerProvider(lambdaSigner);
mainnetToolkit.setPackerProvider(michelEncoder);

const getContract = memoizee(
  (address, shouldUseWallet) =>
    shouldUseWallet
      ? mainnetToolkit.wallet.at(address, tzip12)
      : mainnetToolkit.contract.at(address),
  { promise: true }
);

const getStorage = memoizee(
  async (contractAddress) => {
    const contract = await getContract(contractAddress);
    return contract.storage();
  },
  { promise: true, maxAge: 30000 }
);

const getTokenDescriptor = memoizee(
  async (exchangeContractAddress, contractType) => {
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
  const marketTickers = await fetch("https://api.tzstats.com/markets/tickers");
  const usdTickers = marketTickers.filter((e) => e.quote === "USD");
  // price index: use all USD ticker last prices with equal weight
  const vol = usdTickers.reduce((s, t) => s + t.volume_base, 0) || null;
  const price =
    vol && usdTickers.reduce((s, t) => s + (t.last * t.volume_base) / vol, 0);

  return price;
};
const tezExchangeRateProvider = new SingleQueryDataProvider(
  60000,
  getTezExchangeRate
);

const lambdaContractAddress = "KT1CPuTzwC7h7uLXd5WQmpMFso1HxrLBUtpE";
const getBalance = async (pkh, tokenAddress, tokenId) => {
  if (!tokenAddress) {
    return mainnetToolkit.rpc.getBalance(pkh);
  }
  const contract = await getContract(tokenAddress);
  if (contract.views.getBalance) {
    let nat;
    try {
      nat = await contract.views.getBalance(pkh).read(lambdaContractAddress);
    } catch {}
    if (!nat || nat.isNaN()) {
      return new BigNumber(0);
    }
    return nat;
  }
  if (contract.views.balance_of) {
    let nat;
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

const getTotalSupply = async (tokenAddress, tokenId) => {
  const lambdaViewContract = await getContract(tokenAddress);
  if (lambdaViewContract.views.getTotalSupply) {
    try {
      return lambdaViewContract.views
        .getTotalSupply()
        .read(lambdaContractAddress);
    } catch {
      return new BigNumber(0);
    }
  }
  const maybeTzip12Contract = await getContract(tokenAddress, true);
  try {
    const offChainViews = await maybeTzip12Contract.tzip12().metadataViews();
    if (offChainViews.total_supply && offChainViews.total_supply()) {
      return offChainViews.total_supply().executeView(tokenId);
    }
  } catch {}
  const storage = await contract.storage();
  if (storage.total_supply) {
    return storage.total_supply;
  }
  return new BigNumber(0);
};

module.exports = {
  tezExchangeRateProvider,
  getTokenDescriptor,
  getBalance,
  getContract,
  getStorage,
  getTotalSupply,
};
