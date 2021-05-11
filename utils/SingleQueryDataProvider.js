const logger = require("./logger");
const MutexProtectedData = require("./MutexProtectedData");
const PromisifiedSemaphore = require("./PromisifiedSemaphore");

const defaultShouldGiveUp = (e, c) => c > 9;

class SingleQueryDataProvider {
  constructor(refreshParams, fetchFn, shouldGiveUp = defaultShouldGiveUp) {
    this.refreshParams = refreshParams;
    this.fetchFn = fetchFn;
    this.shouldGiveUp = shouldGiveUp;
    this.fetchMutex = new PromisifiedSemaphore();
    this.readyMutex = new PromisifiedSemaphore();
    this.state = new MutexProtectedData({});
    this.init();
  }

  async refetch() {
    if (!this.fetchMutex.available()) {
      return;
    }
    await this.fetchMutex.exec(() => this.makeFetchAttempt());
  }

  async makeFetchAttempt(c = 1) {
    try {
      const result = await this.fetchFn();
      await this.state.setData({ data: result });
    } catch (e) {
      const timeSlot = 1000;
      console.log(Object.keys(e));
      logger.error(
        `Error in SingleQueryDataProvider: ${e.message}\n${e.stack}`
      );
      if (this.shouldGiveUp(e, c)) {
        await this.state.setData({ error: e });
      } else {
        await new Promise((resolve) => {
          this.refetchRetryTimeout = setTimeout(async () => {
            await this.makeFetchAttempt(c + 1);
            resolve();
          }, Math.round((timeSlot * (2 ** c - 1)) / 2));
        });
      }
    }
  }

  async init() {
    await this.readyMutex.exec(() => this.refetch());
    this.refetchInterval = setInterval(
      () => this.refetch(),
      this.refreshParams
    );
  }

  async getState() {
    await this.readyMutex.exec(() => {});
    return this.state.getData();
  }

  finalize() {
    if (this.refetchInterval !== undefined) {
      clearInterval(this.refetchInterval);
    }
    if (this.refetchRetryTimeout !== undefined) {
      clearTimeout(this.refetchRetryTimeout);
    }
  }
}

module.exports = SingleQueryDataProvider;
