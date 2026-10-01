import { Redis } from 'ioredis';

import { isDefined, isNonEmptyString } from '../utils/helpers';

import { getAccountNotificationIndexKey, getAccountNotificationKey } from './account-notifications-keys';
import { AccountNotification } from './notification.interface';
import { storedAccountNotificationSchema } from './notification.schema';
import { isAfterCursor } from './utils/is-after-cursor.util';

const parseStoredAccountNotification = (payload: string) => {
  try {
    return storedAccountNotificationSchema.validateSync(JSON.parse(payload), { stripUnknown: true });
  } catch {
    return undefined;
  }
};

const collectAddressesByNotificationId = (addresses: string[], indexReplies: [Error | null, unknown][]) => {
  const addressesByNotificationId = new Map<string, string[]>();

  for (let i = 0; i < addresses.length; i++) {
    const reply = indexReplies[i];
    if (!isDefined(reply)) {
      continue;
    }

    const [error, ids] = reply;
    if (isDefined(error) || !Array.isArray(ids)) {
      continue;
    }

    const address = addresses[i];
    for (const id of ids) {
      if (!isNonEmptyString(id)) {
        continue;
      }

      const matchingAddresses = addressesByNotificationId.get(id);
      if (isDefined(matchingAddresses)) {
        matchingAddresses.push(address);
      } else {
        addressesByNotificationId.set(id, [address]);
      }
    }
  }

  return addressesByNotificationId;
};

const toVisibleAccountNotification = (
  payload: string | null | undefined,
  matchingAddresses: string[] | undefined,
  now: number,
  minScore: number,
  minId: number
): AccountNotification | undefined => {
  if (!isNonEmptyString(payload) || !isDefined(matchingAddresses)) {
    return undefined;
  }

  const notification = parseStoredAccountNotification(payload);
  if (!isDefined(notification)) {
    return undefined;
  }

  const createdAtTimestamp = new Date(notification.createdAt).getTime();
  if (isNonEmptyString(notification.expirationDate) && new Date(notification.expirationDate).getTime() < now) {
    return undefined;
  }

  if (createdAtTimestamp >= now || !isAfterCursor(createdAtTimestamp, notification.id, minScore, minId)) {
    return undefined;
  }

  return {
    ...notification,
    type: notification.type,
    accountAddresses: matchingAddresses
  };
};

export const getAccountNotifications = async (
  client: Redis,
  accountAddresses: string[],
  startFromTime = 0,
  startID = 0
): Promise<AccountNotification[]> => {
  if (accountAddresses.length === 0) {
    return [];
  }

  const minScore = Number.isFinite(startFromTime) ? startFromTime : 0;
  const minId = Number.isFinite(startID) ? startID : 0;
  const indexPipeline = client.pipeline();
  for (const address of accountAddresses) {
    indexPipeline.zrangebyscore(getAccountNotificationIndexKey(address), minScore, '+inf');
  }

  const indexReplies = await indexPipeline.exec();
  if (!isDefined(indexReplies)) {
    return [];
  }

  const addressesByNotificationId = collectAddressesByNotificationId(accountAddresses, indexReplies);
  const notificationIds = Array.from(addressesByNotificationId.keys());
  if (notificationIds.length === 0) {
    return [];
  }

  const payloads = await client.mget(...Array.from(notificationIds, id => getAccountNotificationKey(id)));
  const now = Date.now();
  const result: AccountNotification[] = [];

  for (let i = 0; i < notificationIds.length; i++) {
    const visibleNotification = toVisibleAccountNotification(
      payloads[i],
      addressesByNotificationId.get(notificationIds[i]),
      now,
      minScore,
      minId
    );
    if (isDefined(visibleNotification)) {
      result.push(visibleNotification);
    }
  }

  return result.sort((a, b) => {
    const createdAtDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return b.id - a.id;
  });
};
