import { MANDATORY_NOTIFICATIONS_LIST, NOTIFICATIONS_LIST } from "./notifications-list.data";
import { PlatformType } from "./notification.interface";

export const getNotifications = (platform: PlatformType, startFromTime: number) =>
  [
    ...NOTIFICATIONS_LIST.filter(notification => new Date(notification.createdAt).getTime() > startFromTime),
    ...MANDATORY_NOTIFICATIONS_LIST.map(notification => ({
      ...notification,
      createdAt: new Date(startFromTime).toString()
    }))
  ]
    .filter(
      notification =>
        notification.platforms.includes(platform)
    );
