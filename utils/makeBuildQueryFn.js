const qs = require("qs");
const { fetch } = require("./fetch");

function pick(obj, keys) {
  const newObj = {};
  keys.forEach((key) => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

function makeBuildQueryFn(baseUrl) {
  return (path, toQueryParams) => {
    return (params) => {
      const url = typeof path === "function" ? path(params) : path;
      const queryParams =
        typeof toQueryParams === "function"
          ? toQueryParams(params)
          : toQueryParams
          ? pick(params, toQueryParams)
          : {};
      const queryStr = qs.stringify(queryParams);
      return fetch(
        `${baseUrl}${url}${queryStr.length === 0 ? "" : `?${queryStr}`}`
      );
    };
  };
}

module.exports = makeBuildQueryFn;
