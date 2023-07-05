import { Redis } from 'ioredis';

import { isNonEmptyString } from '../../utils/helpers';
import { Notification, PlatformType } from '../notification.interface';
import { addExistingNotificationsToDb } from './add-existing-notifications-to-db';

export const getNotifications = async (client: Redis, platform: PlatformType, startFromTime: number) => {
  await addExistingNotificationsToDb(client);

  const data = await client.lrange('notifications', 0, -1);

  const now = Date.now();
  const result: Notification[] = [];

  for (let i = 0; i < data.length; i++) {
    const notification: Notification = JSON.parse(data[i]);
    const { isMandatory, createdAt, platforms, expirationDate } = notification;
    const createdAtTimestamp = new Date(createdAt).getTime();

    if (isNonEmptyString(expirationDate) && new Date(expirationDate).getTime() < now) {
      await client.lrem('notifications', 1, JSON.stringify(notification));
      continue;
    }

    if (
      platforms.includes(platform) &&
      (isMandatory === true || (createdAtTimestamp > startFromTime && createdAtTimestamp < now))
    ) {
      result.push(notification);
    }
  }

  return result;
};
