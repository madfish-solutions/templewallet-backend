const pino = require("pino");

const logger = pino({
  prettyPrint: true,
  level: "info",
});

module.exports = logger;