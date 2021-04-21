const memoizee = require("memoizee");
const qs = require("qs");
const DataProvider = require("./DataProvider");
const { fetch } = require("./fetch");

const BCD_BASE_URL = "https://better-call.dev/v1";

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

const getSeries = buildQuery(
  `/stats/mainnet/series`,
  ({ addresses, period, name }) => ({
    address: addresses.join(","),
    period,
    name,
  })
);

const getDApps = buildQuery("/dapps");

const getDAppsDetailsWithoutSeries = buildQuery(({ slug }) => `/dapps/${slug}`);
const getDAppDetails = async ({ slug }) => {
  const detailsWithoutSeries = await getDAppsDetailsWithoutSeries({ slug });
  if (!detailsWithoutSeries.contracts) {
    return {
      ...detailsWithoutSeries,
      estimatedUsersPerMonth: 0,
    };
  }
  const series = await getSeries({
    addresses: detailsWithoutSeries.contracts
      .filter(({ network }) => network === "mainnet")
      .map(({ address }) => address),
    period: "month",
    name: "users",
  });
  const lastSeries = series.slice(-2);
  let estimatedUsersPerMonth = 0;
  if (lastSeries.length === 1) {
    estimatedUsersPerMonth = lastSeries[0][1];
  } else if (lastSeries.length > 1) {
    const [
      [, prevMonthUsers],
      [currentMonthTimestamp, currentMonthUsers],
    ] = lastSeries;
    const nowTimestamp = Date.now();
    const currentMonthPartMs = nowTimestamp - currentMonthTimestamp;
    const oneWeekMs = 7 * 24 * 3600 * 1000;
    if (currentMonthPartMs < oneWeekMs) {
      estimatedUsersPerMonth = prevMonthUsers;
    } else {
      const nextMonthDate = new Date(currentMonthTimestamp);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const currentMonthUsersEstimation = Math.round(
        ((nextMonthDate.getTime() - currentMonthTimestamp) /
          currentMonthPartMs) *
          currentMonthUsers
      );
      estimatedUsersPerMonth = Math.max(
        Math.round((prevMonthUsers + currentMonthUsersEstimation) / 2),
        currentMonthUsers
      );
    }
  }
  return {
    ...detailsWithoutSeries,
    estimatedUsersPerMonth,
  };
};

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