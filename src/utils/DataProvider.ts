import MutexProtectedData from './MutexProtectedData';
import SingleQueryDataProvider, { SingleQueryDataProviderState } from './SingleQueryDataProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataSubscriptionItem<T, A extends any[]> = {
  dataProvider: SingleQueryDataProvider<T>;
  args: A;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function argsAreEqual<A extends any[]>(a: A, b: A) {
  return a.length === b.length && a.every((aValue, index) => b[index] === aValue);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class DataProvider<T, A extends any[]> {
  protected subscriptions: MutexProtectedData<DataSubscriptionItem<T, A>[]>;

  constructor(
    private refreshParams: number,
    private fetchFn: (...args: A) => Promise<T>,
    private shouldGiveUp: (e: Error) => boolean = () => false
  ) {
    this.subscriptions = new MutexProtectedData<DataSubscriptionItem<T, A>[]>([]);
  }

  async subscribe(...args: A) {
    await this.subscriptions.exec(async () => {
      const subscriptions = [...this.subscriptions.data];
      if (subscriptions.some(({ args: subscribedArgs }) => argsAreEqual(args, subscribedArgs))) {
        return;
      }
      subscriptions.push({
        dataProvider: new SingleQueryDataProvider(this.refreshParams, () => this.fetchFn(...args), this.shouldGiveUp),
        args
      });
      this.subscriptions.data = subscriptions;
    });
  }

  async get(...args: A): Promise<SingleQueryDataProviderState<T>> {
    const subscriptions = await this.subscriptions.getData();
    const subscription = subscriptions.find(({ args: subscribedArgs }) => argsAreEqual(args, subscribedArgs));
    if (subscription) {
      return subscription.dataProvider.getState();
    }
    try {
      const data = await this.fetchFn(...args);

      return { data };
    } catch (error) {
      // @ts-ignore
      return { error };
    }
  }
}
