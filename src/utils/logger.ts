import pino from 'pino';

const logger = pino({
  prettyPrint: true,
  level: 'info'
});

export default logger;
