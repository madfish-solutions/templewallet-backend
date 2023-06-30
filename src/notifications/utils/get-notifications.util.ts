import { Redis } from 'ioredis';

import { MANDATORY_NOTIFICATIONS_LIST } from '../mandatory-notifications-list.data';
import { Notification, PlatformType } from '../notification.interface';
import { addDefaultNotifications } from './addDefaultNotifications';
import { clearExpiredNotifications } from './clear-expired-notifications.util';

export const getNotifications = async (client: Redis, platform: PlatformType, startFromTime: number) => {
  await addDefaultNotifications(client);

  const data = await client.lrange('notifications', 0, -1);
  const notifications: Notification[] = data.map(item => JSON.parse(item));

  await clearExpiredNotifications(client, notifications);

  return [
    ...notifications.filter(notification => {
      const createdAtTimestamp = new Date(notification.createdAt).getTime();

      return createdAtTimestamp > startFromTime && createdAtTimestamp < Date.now();
    }),
    ...MANDATORY_NOTIFICATIONS_LIST.map(notification => ({
      ...notification,
      createdAt: new Date(startFromTime).toString()
    }))
  ].filter(notification => notification.platforms.includes(platform));
};
