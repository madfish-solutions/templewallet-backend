import { DEFAULT_IMAGE_URLS } from '../default-image-fallbacks';
import { NotificationType, PlatformType } from '../notification.interface';

export const getImageFallback = (platform: PlatformType, notificationType: NotificationType) => {
  if (platform === PlatformType.Mobile) {
    switch (notificationType) {
      case NotificationType.PlatformUpdate:
        return DEFAULT_IMAGE_URLS.mobile.platformUpdate;
      case NotificationType.SecurityNote:
        return DEFAULT_IMAGE_URLS.mobile.securityNote;
      default:
        return DEFAULT_IMAGE_URLS.mobile.news;
    }
  } else {
    switch (notificationType) {
      case NotificationType.PlatformUpdate:
        return DEFAULT_IMAGE_URLS.extension.platformUpdate;
      case NotificationType.SecurityNote:
        return DEFAULT_IMAGE_URLS.extension.securityNote;
      default:
        return DEFAULT_IMAGE_URLS.extension.news;
    }
  }
};
