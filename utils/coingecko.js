const { range } = require("./helpers");
const makeBuildQueryFn = require("./makeBuildQueryFn");
const SingleQueryDataProvider = require("./SingleQueryDataProvider");

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

const buildQuery = makeBuildQueryFn(COINGECKO_BASE_URL);

const getCoins = buildQuery("/coins/list", ["include_platform"]);
const getMarkets = buildQuery(
  "/coins/markets",
  ({
    vs_currency = "usd",
    ids,
    order = "market_cap_desc",
    per_page = 100,
    page = 1,
    sparkline = false,
  }) => ({
    vs_currency,
    ids: ids.join(","),
    order,
    per_page,
    page,
    sparkline,
  })
);

const coinsListProvider = new SingleQueryDataProvider(24 * 3600 * 1000, () =>
  getCoins({})
);

const getMarketsBySymbols = async (symbols) => {
  const { data: coins, error: coinsError } = await coinsListProvider.getState();
  if (coinsError) {
    throw coinsError;
  }
  const matchingCoins = coins.filter(({ symbol }) =>
    symbols.some(
      (matchingSymbol) => matchingSymbol.toLowerCase() === symbol.toLowerCase()
    )
  );
  const pagesNumbers = range(1, matchingCoins.length + 1, 100);
  const ids = matchingCoins.map(({ id }) => id);
  const chunks = await Promise.all(
    pagesNumbers.map((pageNumber) =>
      getMarkets({
        ids,
        page: pageNumber,
      })
    )
  );
  return chunks.flat();
};

module.exports = {
  coinsListProvider,
  getMarketsBySymbols,
};
