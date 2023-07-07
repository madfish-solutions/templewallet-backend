import { Redis } from 'ioredis';

import { EnvVars } from './config';
import logger from './utils/logger';

export const redisClient = new Redis(EnvVars.REDIS_URL);
redisClient.on('error', err => logger.error(err));
