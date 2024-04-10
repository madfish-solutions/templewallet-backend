import { adProvidersMethods, adProvidersMethodsLegacy } from '../advertising/external-ads';
import { redisClient } from '../redis';
import { isDefined } from './helpers';
import logger from './logger';

const DATA_VERSION_STORAGE_KEY = 'data_version';

const migrations = {
  '1': async () => {
    const oldSliseAdsProviders = await adProvidersMethodsLegacy.getAllValues();
    await adProvidersMethods.upsertValues(
      Object.fromEntries(
        Object.entries(oldSliseAdsProviders).map(([providerName, selectors]) => [providerName, [{ selectors }]])
      )
    );
  }
};

export const doMigrations = async () => {
  let currentVersion = await redisClient.get(DATA_VERSION_STORAGE_KEY);

  if (!isDefined(currentVersion)) {
    currentVersion = '0';
    await redisClient.set(DATA_VERSION_STORAGE_KEY, '0');
  }

  logger.info(`Current data version: ${currentVersion}`);

  for (let i = Number(currentVersion) + 1; i <= Object.keys(migrations).length; i++) {
    await migrations[i]();
    await redisClient.set(DATA_VERSION_STORAGE_KEY, String(i));
    logger.info(`Migration to version ${i} completed`);
  }
};
