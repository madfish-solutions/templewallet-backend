import { LowdbSync } from 'lowdb';

import { DbData } from '../interfaces/db-data.interface';
import { PlatformType } from './notification.interface';
import { MANDATORY_NOTIFICATIONS_LIST } from './notifications-list.data';

export const getNotifications = (db: LowdbSync<DbData>, platform: PlatformType, startFromTime: number) =>
  [
    ...db.getState().notifications.filter(notification => new Date(notification.createdAt).getTime() > startFromTime),
    ...MANDATORY_NOTIFICATIONS_LIST.map(notification => ({
      ...notification,
      createdAt: new Date(startFromTime).toString()
    }))
  ].filter(notification => notification.platforms.includes(platform));
