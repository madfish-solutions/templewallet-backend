const qs = require("qs");
const { fetch } = require("./fetch");
const PromisifiedSemaphore = require("./PromisifiedSemaphore");

function pick(obj, keys) {
  const newObj = {};
  keys.forEach((key) => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

function makeBuildQueryFn(baseUrl, maxConcurrentQueries) {
  const semaphore = maxConcurrentQueries
    ? new PromisifiedSemaphore(maxConcurrentQueries)
    : undefined;
  return (path, toQueryParams) => {
    return async (params) => {
      const url = typeof path === "function" ? path(params) : path;
      const queryParams =
        typeof toQueryParams === "function"
          ? toQueryParams(params)
          : toQueryParams
          ? pick(params, toQueryParams)
          : {};
      const queryStr = qs.stringify(queryParams);
      const fullUrl = `${baseUrl}${url}${
        queryStr.length === 0 ? "" : `?${queryStr}`
      }`;
      if (semaphore) {
        let result;
        await semaphore.exec(async () => {
          result = await fetch(fullUrl);
        });
        return result;
      }
      return fetch(fullUrl);
    };
  };
}

module.exports = makeBuildQueryFn;
