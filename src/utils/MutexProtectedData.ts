import PromisifiedSemaphore from './PromisifiedSemaphore';

export default class MutexProtectedData<T> {
  private mutex: PromisifiedSemaphore;

  constructor(public data: T) {
    this.mutex = new PromisifiedSemaphore();
  }

  exec<U = void>(task: (data: T, setData: (value: T) => void) => U | Promise<U>) {
    return this.mutex.exec(() => task(this.data, value => void (this.data = value)));
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
