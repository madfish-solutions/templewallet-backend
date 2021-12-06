import logger from "./logger";
import MutexProtectedData from "./MutexProtectedData";
import PromisifiedSemaphore from "./PromisifiedSemaphore";

export type SingleQueryDataProviderState<T> = {
  data?: T;
  error?: Error;
};

const defaultShouldGiveUp = (_e: Error, c: number) => c > 9;

export default class SingleQueryDataProvider<T> {
  private state: MutexProtectedData<SingleQueryDataProviderState<T>>;

  private fetchMutex: PromisifiedSemaphore;

  private readyMutex: PromisifiedSemaphore;

  private refetchInterval: NodeJS.Timeout | undefined;

  private refetchRetryTimeout: NodeJS.Timeout | undefined;

  constructor(
    private refreshParams: number,
    private fetchFn: () => Promise<T>,
    private shouldGiveUp = defaultShouldGiveUp
  ) {
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
      logger.error(`Error in SingleQueryDataProvider: ${e}`);
      if (this.shouldGiveUp(e, c)) {
        await this.state.setData({ error: e });
      } else {
        await new Promise<void>((resolve) => {
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
