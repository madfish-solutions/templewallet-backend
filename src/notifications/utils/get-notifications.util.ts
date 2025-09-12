import { Redis } from 'ioredis';

import { isNonEmptyString, isTruthy } from '../../utils/helpers';
import { Notification, PlatformType } from '../notification.interface';

export const getNotifications = async (client: Redis, platform: PlatformType, startFromTime: number) => {
  const data = await client.lrange('notifications', 0, -1);
  const notifications: Notification[] = data
    .map(item => JSON.parse(item))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const now = Date.now();
  const result: Notification[] = [];

  for (let i = 0; i < notifications.length; i++) {
    const { isMandatory, createdAt, platforms, expirationDate } = notifications[i];
    const createdAtTimestamp = new Date(createdAt).getTime();

    if (isNonEmptyString(expirationDate) && new Date(expirationDate).getTime() < now) {
      await client.lrem('notifications', 1, JSON.stringify(notifications[i]));
      continue;
    }

    const platformMatch = platforms.includes(platform);
    const mandatoryTimeMatch = isTruthy(isMandatory) && createdAtTimestamp < now;
    const timeScopeMatch = createdAtTimestamp > startFromTime && createdAtTimestamp < now;

    if (platformMatch && (mandatoryTimeMatch || timeScopeMatch)) {
      result.push(notifications[i]);
    }
  }

  return result;
};
