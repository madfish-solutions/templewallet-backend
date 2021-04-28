const SingleQueryDataProvider = require("./SingleQueryDataProvider");

function argsAreEqual(a, b) {
  return (
    a.length === b.length && a.every((aValue, index) => b[index] === aValue)
  );
}

class DataProvider {
  subscriptions = [];

  constructor(refreshParams, fetchFn, shouldGiveUp) {
    this.refreshParams = refreshParams;
    this.fetchFn = fetchFn;
    this.shouldGiveUp = shouldGiveUp;
  }

  subscribe(...args) {
    if (
      this.subscriptions.some(({ args: subscribedArgs }) =>
        argsAreEqual(args, subscribedArgs)
      )
    ) {
      return;
    }
    this.subscriptions.push({
      dataProvider: new SingleQueryDataProvider(
        this.refreshParams,
        () => this.fetchFn(...args),
        this.shouldGiveUp
      ),
      args,
    });
  }

  async get(...args) {
    const subscription = this.subscriptions.find(({ args: subscribedArgs }) =>
      argsAreEqual(args, subscribedArgs)
    );
    if (subscription) {
      return subscription.dataProvider.getState();
    }
    try {
      const data = await this.fetchFn(...args);
      return { data };
    } catch (error) {
      return { error };
    }
  }
}

module.exports = DataProvider;
