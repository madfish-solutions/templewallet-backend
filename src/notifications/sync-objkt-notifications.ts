import { EnvVars } from '../config';
import { redisClient } from '../redis';
import { isDefined, isNonEmptyString, safePromiseAll } from '../utils/helpers';
import logger from '../utils/logger';
import { getAuctionBids, getNftSales, getOffersReceived } from '../utils/objkt';

import { ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY } from './account-notifications-keys';
import { addAccountNotifications } from './add-account-notifications';
import { mapObjktEventsToAccountNotifications } from './from-objkt-events';

const OBJKT_SYNC_STATE_KEY = 'account-notifications-objkt-sync-at';
const OBJKT_SYNC_OVERLAP_MS = 30_000;
const OBJKT_SYNC_LOCK_TTL_SECONDS = 9 * 60;

const getSyncSince = async () => {
  const stored = await redisClient.get(OBJKT_SYNC_STATE_KEY);
  const lookbackSince = Date.now() - EnvVars.OBJKT_NOTIFICATIONS_LOOKBACK_MS;
  const storedSince = isNonEmptyString(stored) ? Date.parse(stored) : Number.NaN;
  const hasCursor = Number.isFinite(storedSince);
  const sinceMs = hasCursor ? Math.max(storedSince, lookbackSince) : lookbackSince;

  return { since: new Date(sinceMs), hasCursor };
};

export const syncObjktNotifications = async () => {
  const lock = await redisClient.set(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY, '1', 'EX', OBJKT_SYNC_LOCK_TTL_SECONDS, 'NX');
  if (lock !== 'OK') {
    logger.info('Objkt notifications sync skipped: another worker holds the lock');

    return;
  }

  try {
    const { since, hasCursor } = await getSyncSince();
    const startedAt = Date.now();
    const [offers, bids, sales] = await safePromiseAll([
      getOffersReceived(since),
      getAuctionBids(since),
      getNftSales(since)
    ]);
    const items = mapObjktEventsToAccountNotifications(offers, bids, sales);

    await addAccountNotifications(redisClient, items, { publish: hasCursor });
    await redisClient.set(OBJKT_SYNC_STATE_KEY, new Date(startedAt - OBJKT_SYNC_OVERLAP_MS).toISOString());

    logger.info(
      `Synced ${items.length} Objkt notifications (offers=${offers.length}, bids=${bids.length}, sales=${sales.length})`
    );
  } finally {
    await redisClient.del(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY);
  }
};

let syncInterval: NodeJS.Timeout | undefined;
let syncInFlight = false;

export const stopObjktNotificationsSync = () => {
  if (!isDefined(syncInterval)) {
    return;
  }

  clearInterval(syncInterval);
  syncInterval = undefined;
};

export const startObjktNotificationsSync = () => {
  if (!isDefined(syncInterval)) {
    const runSync = () => {
      if (syncInFlight) {
        return;
      }

      syncInFlight = true;
      syncObjktNotifications()
        .catch(error => {
          logger.error('Objkt notifications sync failed', error);
        })
        .finally(() => {
          syncInFlight = false;
        });
    };

    runSync();
    syncInterval = setInterval(runSync, EnvVars.OBJKT_NOTIFICATIONS_POLL_INTERVAL_MS);
    syncInterval.unref();
  }

  return { stop: stopObjktNotificationsSync };
};
