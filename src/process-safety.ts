import { inspect } from 'util';

import logger from './utils/logger';

// Data providers poll third-party APIs for the whole lifetime of the process. Node aborts on an unhandled
// rejection, so one orphaned rejection from a provider would tear down an already serving HTTP server.
process.on('unhandledRejection', reason => {
  const error = reason instanceof Error ? reason : new Error(inspect(reason));

  logger.error(`Unhandled rejection: ${error.message}\n${error.stack}`);
});
