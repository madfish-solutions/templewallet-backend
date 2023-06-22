const IMAGE_BUCKET_URL = 'https://generic-objects.fra1.digitaloceanspaces.com/notification-icons';

export const DEFAULT_IMAGE_URLS = {
  extension: {
    news: `${IMAGE_BUCKET_URL}/extension/news.svg`,
    platformUpdate: `${IMAGE_BUCKET_URL}/extension/platform-update.svg`,
    securityNote: `${IMAGE_BUCKET_URL}/extension/security-note.svg`
  },
  mobile: {
    news: `${IMAGE_BUCKET_URL}/mobile/news.svg`,
    platformUpdate: `${IMAGE_BUCKET_URL}/mobile/platform-update.svg`,
    securityNote: `${IMAGE_BUCKET_URL}/mobile/security-note.svg`
  }
};
