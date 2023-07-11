import '../../src/configure';

import { Redis } from 'ioredis';
import { EnvVars } from '../../src/config';
import { addExistingNotificationsToDb } from './utils/add-existing-notifications-to-db';
import logger from '../../src/utils/logger';

const redisClient = new Redis(EnvVars.REDIS_URL);

redisClient.on('error', err => logger.error(err));

(async () => {
  await addExistingNotificationsToDb(redisClient);
  logger.info('Notifications successfully added to Redis database.');
  process.exit(0);
})();
