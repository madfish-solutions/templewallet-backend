import { Redis } from 'ioredis';

import { Notification } from '../notification.interface';

export const sortNotifications = async (client: Redis) => {
  const data = await client.lrange('notifications', 0, -1);
  const notifications: Notification[] = data.map(item => JSON.parse(item));
  const sortedNotifications = notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  await client.del('notifications');

  for (let i = 0; i < sortedNotifications.length; i++) {
    await client.rpush('notifications', JSON.stringify(sortedNotifications[i]));
  }
};
