import { Redis } from 'ioredis';

import { DEFAULT_NOTIFICATIONS_LIST, MANDATORY_NOTIFICATIONS_LIST } from '../existing-notifications.data';

//TODO: delete after deploy
export const addExistingNotificationsToDb = async (client: Redis) => {
  const data = await client.lrange('notifications', 0, -1);
  const existingNotifications = [...DEFAULT_NOTIFICATIONS_LIST, ...MANDATORY_NOTIFICATIONS_LIST];

  if (data.length === 0) {
    for (let i = 0; i < existingNotifications.length; i++) {
      await client.rpush('notifications', JSON.stringify(existingNotifications[i]));
    }
  }
};
