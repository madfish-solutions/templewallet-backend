import PromisifiedSemaphore from './PromisifiedSemaphore';

export default class MutexProtectedData<T> {
  private mutex: PromisifiedSemaphore;

  constructor(public data: T) {
    this.mutex = new PromisifiedSemaphore();
  }

  exec(task: () => void | Promise<void>) {
    return this.mutex.exec(task);
  }

  setData(newData: T) {
    return this.mutex.exec(() => {
      this.data = newData;
    });
  }

  getData(): Promise<T> {
    return new Promise(resolve => {
      this.mutex.exec(() => resolve(this.data));
    });
  }
}
