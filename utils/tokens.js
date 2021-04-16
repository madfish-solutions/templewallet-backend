const BigNumber = require("bignumber.js");
const memoizee = require("memoizee");
const {
  detailedDAppDataProvider,
  getContractTokens,
} = require("./better-call-dev");
const { getTokenDescriptor, getStorage } = require("./tezos");
const SingleQueryDataProvider = require("./SingleQueryDataProvider");

const getQuipuswapExchangers = async() => {
  const fa12FactoryStorage = await getStorage(
    "KT1K7whn5yHucGXMN7ymfKiX5r534QeaJM29"
  );
  const fa2FactoryStorage = await getStorage(
    "KT1MMLb2FVrrE9Do74J3FH1RNNc4QhDuVCNX"
  );
  const rawFa12FactoryTokens = await fa12FactoryStorage.token_list.getMultipleValues(
    Array(fa12FactoryStorage.counter.toNumber())
    .fill(0)
    .map((_x, index) => index)
  );
  const fa12FactoryTokens = Object.values(rawFa12FactoryTokens);
  const rawFa12Exchangers = await fa12FactoryStorage.token_to_exchange.getMultipleValues(
    fa12FactoryTokens
  );
  const fa12Exchangers = await Promise.all(
    Object.entries(rawFa12Exchangers).map(
      async([tokenAddress, exchangerAddress]) => {
        const tokensMetadata = await getContractTokens({
          network: "mainnet",
          address: tokenAddress,
        });
        return {
          tokenAddress,
          exchangerAddress,
          tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
        };
      }
    )
  );

  const rawFa2FactoryTokens = await fa2FactoryStorage.token_list.getMultipleValues(
    Array(fa2FactoryStorage.counter.toNumber())
    .fill(0)
    .map((_x, index) => index)
  );
  const fa2FactoryTokens = Object.values(rawFa2FactoryTokens);
  const rawFa2Exchangers = await Promise.all(
    fa2FactoryTokens.map(async(token) => [
      token,
      await fa2FactoryStorage.token_to_exchange.get(token),
    ])
  );
  const fa2Exchangers = await Promise.all(
    rawFa2Exchangers.map(async([tokenDescriptor, exchangerAddress]) => {
      const tokensMetadata = await getContractTokens({
        network: "mainnet",
        address: tokenDescriptor[0],
        token_id: tokenDescriptor[1].toNumber(),
      });
      return {
        exchangerAddress,
        tokenAddress: tokenDescriptor[0],
        tokenId: tokenDescriptor[1].toNumber(),
        tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
      };
    })
  );
  return [...fa12Exchangers, ...fa2Exchangers];
};
const quipuswapExchangersDataProvider = new SingleQueryDataProvider(
  14 * 60 * 1000,
  getQuipuswapExchangers
);

const LIQUIDITY_INTERVAL = 120000;
const getTokenExchangeRate = memoizee(
  async({ contract: tokenAddress, decimals, token_id }) => {
    const {
      data: dexterDAppData,
      error: dexterDAppError,
    } = await detailedDAppDataProvider.get("dexter");
    const {
      data: quipuswapExchangers,
      error: quipuswapExchangersError,
    } = await quipuswapExchangersDataProvider.getState();
    if (dexterDAppError || quipuswapExchangersError) {
      throw dexterDAppError || quipuswapExchangersError;
    }
    let quipuswapExchangeRate = new BigNumber(0);
    let quipuswapWeight = new BigNumber(0);
    let dexterExchangeRate = new BigNumber(0);
    let dexterWeight = new BigNumber(0);
    const tokenElementaryParts = new BigNumber(10).pow(decimals);
    const quipuswapExchanger = quipuswapExchangers.find(
      ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
      tokenAddress === swappableTokenAddress &&
      (swappableTokenId === undefined || swappableTokenId === token_id)
    );
    const exchangerAddress =
      quipuswapExchanger && quipuswapExchanger.exchangerAddress;
    if (exchangerAddress) {
      const {
        storage: { tez_pool, token_pool },
      } = await getStorage(exchangerAddress);
      if (!tez_pool.eq(0) && !token_pool.eq(0)) {
        quipuswapWeight = tez_pool;
        quipuswapExchangeRate = tez_pool
          .div(1e6)
          .div(token_pool.div(tokenElementaryParts));
      }
    }
    for (const contractData of dexterDAppData.contracts) {
      const { network, address: exchangerAddress } = contractData;
      if (network !== "mainnet") {
        continue;
      }
      const {
        address: contractTokenAddress,
        tokenId,
      } = await getTokenDescriptor(exchangerAddress, "dexter");
      if (
        contractTokenAddress !== tokenAddress ||
        (tokenId !== undefined && tokenId !== token_id)
      ) {
        continue;
      }
      const { xtzPool, tokenPool } = await getStorage(exchangerAddress);
      if (!xtzPool.eq(0) && !tokenPool.eq(0)) {
        dexterWeight = xtzPool;
        dexterExchangeRate = xtzPool
          .div(1e6)
          .div(tokenPool.div(tokenElementaryParts));
      }
      break;
    }
    if (quipuswapExchangeRate.eq(0) && dexterExchangeRate.eq(0)) {
      return new BigNumber(0);
    }
    return quipuswapExchangeRate
      .multipliedBy(quipuswapWeight)
      .plus(dexterExchangeRate.multipliedBy(dexterWeight))
      .div(quipuswapWeight.plus(dexterWeight));
  }, { promise: true, maxAge: LIQUIDITY_INTERVAL }
);

module.exports = {
  getTokenExchangeRate,
  quipuswapExchangersDataProvider,
};