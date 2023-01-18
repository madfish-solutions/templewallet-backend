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

  exec(task: () => void | Promise<void>, n = 1) {
    return new Promise<void>((resolve, reject) => {
      this.semaphore.take(n, async () => {
        try {
          await task();
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          this.semaphore.leave(n);
        }
      });
    });
  }
}
