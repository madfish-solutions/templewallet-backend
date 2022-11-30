import { NOTIFICATIONS_LIST } from "./notifications-list.data";
import { PlatformType } from "./notification.interface";

export const getNotifications = (platform: PlatformType, startFromTime: number) =>
  NOTIFICATIONS_LIST.filter(
    notification =>
      notification.platforms.includes(platform) &&
      new Date(notification.createdAt).getTime() > startFromTime
  );
