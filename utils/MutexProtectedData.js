const PromisifiedSemaphore = require("./PromisifiedSemaphore");

class MutexProtectedData {
  constructor(data) {
    this.data = data;
    this.mutex = new PromisifiedSemaphore();
  }

  exec(task) {
    return this.mutex.exec(task);
  }

  setData(newData) {
    return this.mutex.exec(() => {
      this.data = newData;
    });
  }

  getData() {
    return new Promise((resolve) => {
      this.mutex.exec(() => resolve(this.data));
    });
  }
}

module.exports = MutexProtectedData;
