const memoizee = require("memoizee");
const qs = require("qs");
const DataProvider = require("./DataProvider");
const { fetch } = require("./fetch");

const BCD_BASE_URL = "https://api.better-call.dev/v1";

function pick(obj, keys) {
  const newObj = {};
  keys.forEach((key) => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

function buildQuery(path, toQueryParams) {
  return (params) => {
      const url = typeof path === "function" ? path(params) : path;
      const queryParams =
        typeof toQueryParams === "function" ?
        toQueryParams(params) :
        toQueryParams ?
        pick(params, toQueryParams) :
        {};
      const queryStr = qs.stringify(queryParams);
      return fetch(
          `${BCD_BASE_URL}${url}${queryStr.length === 0 ? "" : `?${queryStr}`}`
    );
  };
}

const getDApps = buildQuery("/dapps");
const getDAppDetails = buildQuery(({ slug }) => `/dapps/${slug}`);
const getAccountTokenBalances = buildQuery(
  (params) => `/account/${params.network}/${params.address}/token_balances`,
  ["offset", "size", "contract"]
);
const getContractTokens = memoizee(
  buildQuery(
    (params) => `/contract/${params.network}/${params.address}/tokens`,
    ["size", "offset", "token_id"]
  ),
  { maxAge: 24 * 3600 * 1000, promise: true }
);

const detailedDAppDataProvider = new DataProvider(14 * 60 * 1000, (slug) =>
  getDAppDetails({ slug })
);

module.exports = {
  detailedDAppDataProvider,
  getAccountTokenBalances,
  getDApps,
  getDAppDetails,
  getContractTokens,
};