import { Notification } from '../notifications/notification.interface';

export interface DbData {
  notifications: Notification[];
  notificationsExpirationDates: Record<string, string>;
}
