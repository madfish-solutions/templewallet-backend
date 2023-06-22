import { LowdbSync } from 'lowdb';

import { DbData } from '../../interfaces/db-data.interface';
import { MANDATORY_NOTIFICATIONS_LIST } from '../mandatory-notifications-list.data';
import { PlatformType } from '../notification.interface';
import { clearExpiredNotifications } from './clear-expired-notifications.util';

export const getNotifications = (db: LowdbSync<DbData>, platform: PlatformType, startFromTime: number) => {
  clearExpiredNotifications(db);
  const { notifications } = db.getState();

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
