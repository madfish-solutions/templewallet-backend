const MutexProtectedData = require("./MutexProtectedData");
const SingleQueryDataProvider = require("./SingleQueryDataProvider");

function argsAreEqual(a, b) {
  return (
    a.length === b.length && a.every((aValue, index) => b[index] === aValue)
  );
}

class DataProvider {
  constructor(refreshParams, fetchFn, shouldGiveUp = undefined) {
    this.subscriptions = new MutexProtectedData([]);
    this.refreshParams = refreshParams;
    this.fetchFn = fetchFn;
    this.shouldGiveUp = shouldGiveUp;
  }

  async subscribe(...args) {
    await this.subscriptions.exec(async () => {
      const subscriptions = [...this.subscriptions.data];
      if (
        subscriptions.some(({ args: subscribedArgs }) =>
          argsAreEqual(args, subscribedArgs)
        )
      ) {
        return;
      }
      subscriptions.push({
        dataProvider: new SingleQueryDataProvider(
          this.refreshParams,
          () => this.fetchFn(...args),
          this.shouldGiveUp
        ),
        args,
      });
      this.subscriptions.data = subscriptions;
    });
  }

  async get(...args) {
    const subscriptions = await this.subscriptions.getData();
    const subscription = subscriptions.find(({ args: subscribedArgs }) =>
      argsAreEqual(args, subscribedArgs)
    );
    if (subscription) {
      return subscription.dataProvider.getState();
    }
    console.log("oy vey", args, subscriptions);
    try {
      const data = await this.fetchFn(...args);
      return { data };
    } catch (error) {
      return { error };
    }
  }
}

module.exports = DataProvider;
