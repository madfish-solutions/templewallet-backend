function range(start, end, step = 1) {
  return Array(Math.ceil((end - start) / step))
    .fill(0)
    .map((_x, index) => start + step * index);
}

module.exports = {
  range,
};
