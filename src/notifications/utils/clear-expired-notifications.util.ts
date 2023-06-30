import { Redis } from 'ioredis';

import { isDefined } from '../../utils/helpers';
import { Notification } from '../notification.interface';

export const clearExpiredNotifications = async (client: Redis, notifications: Notification[]) => {
  const now = Date.now();
  const expiredNotifications = notifications.filter(
    ({ expirationDate }) => isDefined(expirationDate) && new Date(expirationDate).getTime() < now
  );

  if (expiredNotifications.length > 0) {
    for (let i = 0; i < expiredNotifications.length; i++) {
      await client.lrem('notifications', 1, JSON.stringify(expiredNotifications[i]));
    }
  }
};
