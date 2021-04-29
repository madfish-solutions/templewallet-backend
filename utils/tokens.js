const BigNumber = require("bignumber.js");
const memoizee = require("memoizee");
const {
  detailedDAppDataProvider,
  contractTokensProvider,
} = require("./better-call-dev");
const { getTokenDescriptor, getStorage } = require("./tezos");
const SingleQueryDataProvider = require("./SingleQueryDataProvider");
const { range } = require("./helpers");

const getQuipuswapExchangers = async () => {
  const fa12FactoryStorages = await Promise.all(
    [
      "KT1K7whn5yHucGXMN7ymfKiX5r534QeaJM29",
      "KT1Lw8hCoaBrHeTeMXbqHPG4sS4K1xn7yKcD",
    ].map((factoryAddress) => getStorage(factoryAddress))
  );
  const fa2FactoryStorages = await Promise.all(
    [
      "KT1MMLb2FVrrE9Do74J3FH1RNNc4QhDuVCNX",
      "KT1SwH9P1Tx8a58Mm6qBExQFTcy2rwZyZiXS",
    ].map((factoryAddress) => getStorage(factoryAddress))
  );
  const rawFa12FactoryTokens = await Promise.all(
    fa12FactoryStorages.map((storage) => {
      return storage.token_list.getMultipleValues(
        range(0, storage.counter.toNumber())
      );
    })
  );
  const rawFa12Exchangers = await Promise.all(
    fa12FactoryStorages.map((storage, index) =>
      storage.token_to_exchange.getMultipleValues(
        Object.values(rawFa12FactoryTokens[index])
      )
    )
  );
  const fa12Exchangers = (
    await Promise.all(
      rawFa12Exchangers.map((rawFa12ExchangersChunk) => {
        return Promise.all(
          Object.entries(rawFa12ExchangersChunk).map(
            async ([tokenAddress, exchangerAddress]) => {
              await contractTokensProvider.subscribe("mainnet", tokenAddress);
              const {
                data: tokensMetadata,
                error,
              } = await contractTokensProvider.get("mainnet", tokenAddress);
              if (error) {
                throw error;
              }
              return {
                tokenAddress,
                exchangerAddress,
                tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
              };
            }
          )
        );
      })
    )
  ).flat();

  const rawFa2FactoryTokens = await Promise.all(
    fa2FactoryStorages.map((storage) =>
      storage.token_list.getMultipleValues(range(0, storage.counter.toNumber()))
    )
  );
  const rawFa2Exchangers = await Promise.all(
    rawFa2FactoryTokens.map((rawTokens, index) => {
      return Promise.all(
        Object.values(rawTokens).map(async (token) => [
          token,
          await fa2FactoryStorages[index].token_to_exchange.get(token),
        ])
      );
    })
  );
  const fa2Exchangers = (
    await Promise.all(
      rawFa2Exchangers.map((exchangersPart) => {
        return Promise.all(
          exchangersPart.map(async ([tokenDescriptor, exchangerAddress]) => {
            const address = tokenDescriptor[0];
            const token_id = tokenDescriptor[1].toNumber();
            await contractTokensProvider.subscribe(
              "mainnet",
              address,
              token_id
            );
            const {
              data: tokensMetadata,
              error,
            } = await contractTokensProvider.get("mainnet", address, token_id);
            if (error) {
              throw error;
            }
            return {
              exchangerAddress,
              tokenAddress: address,
              tokenId: token_id,
              tokenMetadata: tokensMetadata ? tokensMetadata[0] : undefined,
            };
          })
        );
      })
    )
  ).flat();
  return [...fa12Exchangers, ...fa2Exchangers];
};
const quipuswapExchangersDataProvider = new SingleQueryDataProvider(
  14 * 60 * 1000,
  getQuipuswapExchangers
);

const LIQUIDITY_INTERVAL = 120000;
const getTokenExchangeRate = memoizee(
  async ({ contract: tokenAddress, decimals, token_id }) => {
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
    const matchingQuipuswapExchangers = quipuswapExchangers.filter(
      ({ tokenAddress: swappableTokenAddress, tokenId: swappableTokenId }) =>
        tokenAddress === swappableTokenAddress &&
        (swappableTokenId === undefined || swappableTokenId === token_id)
    );
    if (matchingQuipuswapExchangers.length > 0) {
      const exchangersCharacteristics = await Promise.all(
        matchingQuipuswapExchangers.map(async ({ exchangerAddress }) => {
          const {
            storage: { tez_pool, token_pool },
          } = await getStorage(exchangerAddress);
          if (!tez_pool.eq(0) && !token_pool.eq(0)) {
            return {
              weight: tez_pool,
              exchangeRate: tez_pool
                .div(1e6)
                .div(token_pool.div(tokenElementaryParts)),
            };
          }
          return { weight: new BigNumber(0), exchangeRate: new BigNumber(0) };
        })
      );
      quipuswapWeight = exchangersCharacteristics.reduce(
        (sum, { weight }) => sum.plus(weight),
        new BigNumber(0)
      );
      if (!quipuswapWeight.eq(0)) {
        quipuswapExchangeRate = exchangersCharacteristics
          .reduce(
            (sum, { weight, exchangeRate }) =>
              sum.plus(weight.multipliedBy(exchangeRate)),
            new BigNumber(0)
          )
          .div(quipuswapWeight);
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
  },
  { promise: true, maxAge: LIQUIDITY_INTERVAL }
);

const getTotalSupplyPrice = async (token, exchangeableTokensWithPrices) => {
  const exchangeableToken = exchangeableTokensWithPrices.find(
    ({ contract, token_id }) =>
      contract === token.contract && token_id === token.token_id
  );
  const tokenPrice = exchangeableToken
    ? exchangeableToken.price
    : new BigNumber(0);
  let tokenSupply = token.supply;
  if (tokenSupply === undefined) {
    const storage = await getStorage(contracts[0].address);
    totalSupply = storage.total_supply || storage.totalSupply || 0;
  }
  const tvl = new BigNumber(token.supply)
    .div(new BigNumber(10).pow(token.decimals))
    .multipliedBy(tokenPrice);
  return tvl;
};

module.exports = {
  getTokenExchangeRate,
  getTotalSupplyPrice,
  quipuswapExchangersDataProvider,
};
