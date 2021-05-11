const semaphore = require("semaphore");

class PromisifiedSemaphore {
  constructor(capacity = 1) {
    this.semaphore = semaphore(capacity);
  }

  capacity() {
    return this.semaphore.capacity;
  }

  available(n = 1) {
    return this.semaphore.available(n);
  }

  exec(task, n = 1) {
    return new Promise((resolve, reject) => {
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

module.exports = PromisifiedSemaphore;
