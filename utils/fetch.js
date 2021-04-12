const crossFetch = require("cross-fetch");

class InvalidStatusError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class NotOkFetchError extends Error {}

async function fetch(url, init) {
  const res = await crossFetch(url, init);

  const body = await res.json();
  if (res.status >= 400) {
    throw new InvalidStatusError(body.message, res.status);
  }
  if (!res.ok) {
    throw new NotOkFetchError("An error occurred while fetching");
  }
  return body;
}

module.exports = {
  InvalidStatusError,
  NotOkFetchError,
  fetch,
};