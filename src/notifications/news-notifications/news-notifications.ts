import { NEWS_LIST, WELCOME_NOTIFICATIONS_LIST } from "./news-notifications.data";
import { PlatformType } from "./news-notifications.interface";

export const getNewsNotifications = (addWelcomeNotifications = false, platform: PlatformType, startFromDate?: string) => {
  const startFromTime = new Date(startFromDate ?? '').getTime();

  return [
    ...addWelcomeNotifications ? WELCOME_NOTIFICATIONS_LIST : [],
    ...NEWS_LIST.filter(notification => {
      if (isNaN(startFromTime)) {
        return true;
      }

      return new Date(notification.createdAt).getTime() > startFromTime;
    } )
  ].filter(notification => notification.platforms.includes(platform));
};
