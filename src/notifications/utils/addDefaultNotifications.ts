import { Redis } from 'ioredis';

import { DEFAULT_NOTIFICATIONS_LIST } from '../default-notifications-list.data';

//TODO: delete after deploy
export const addDefaultNotifications = async (client: Redis) => {
  const data = await client.lrange('notifications', 0, -1);
  if (data.length === 0) {
    for (let i = 0; i < DEFAULT_NOTIFICATIONS_LIST.length; i++) {
      await client.rpush('notifications', JSON.stringify(DEFAULT_NOTIFICATIONS_LIST[i]));
    }
  }
};
