import semaphore, { Semaphore } from 'semaphore';

export default class PromisifiedSemaphore {
  private semaphore: Semaphore;

  constructor(capacity = 1) {
    this.semaphore = semaphore(capacity);
  }

  capacity() {
    return this.semaphore.capacity;
  }

  available(n = 1) {
    return this.semaphore.available(n);
  }

  exec<T = void>(task: () => T | Promise<T>, n = 1) {
    return new Promise<T>((resolve, reject) => {
      this.semaphore.take(n, async () => {
        try {
          resolve(await task());
        } catch (e) {
          reject(e);
        } finally {
          this.semaphore.leave(n);
        }
      });
    });
  }
}
