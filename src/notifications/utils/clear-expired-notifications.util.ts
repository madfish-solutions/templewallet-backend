import { LowdbSync } from 'lowdb';

import { DbData } from '../../interfaces/db-data.interface';

export const clearExpiredNotifications = (db: LowdbSync<DbData>) => {
  const { notificationsExpirationDates } = db.getState();

  const expiredNotificationsIds = Object.keys(notificationsExpirationDates).filter(
    key => new Date(notificationsExpirationDates[key]).getTime() < Date.now()
  );

  if (expiredNotificationsIds.length > 0) {
    const notifications = db.get('notifications');
    const expirationDates = db.get('notificationsExpirationDates');

    expiredNotificationsIds.forEach(expiredId => {
      notifications.remove({ id: Number(expiredId) }).value();
      expirationDates.unset(expiredId).value();
    });
    db.write();
  }
};
