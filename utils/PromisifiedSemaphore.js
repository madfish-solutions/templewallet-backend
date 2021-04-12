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
    return new Promise((resolve) => {
      this.semaphore.take(n, async() => {
        await task();
        this.semaphore.leave(n);
        resolve();
      });
    });
  }
}

module.exports = PromisifiedSemaphore;