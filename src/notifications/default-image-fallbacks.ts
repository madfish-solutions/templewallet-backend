const IMAGES_BUCKET_URL = 'https://generic-objects.fra1.digitaloceanspaces.com/notification-icons';

export const DEFAULT_IMAGE_URLS = {
  extension: {
    news: `${IMAGES_BUCKET_URL}/extension/news.svg`,
    platformUpdate: `${IMAGES_BUCKET_URL}/extension/platform-update.svg`,
    securityNote: `${IMAGES_BUCKET_URL}/extension/security-note.svg`,
    winNft: `${IMAGES_BUCKET_URL}/extension/extension-win-nft.svg`
  },
  mobile: {
    news: `${IMAGES_BUCKET_URL}/mobile/news.svg`,
    platformUpdate: `${IMAGES_BUCKET_URL}/mobile/platform-update.svg`,
    securityNote: `${IMAGES_BUCKET_URL}/mobile/security-note.svg`,
    winNft: `${IMAGES_BUCKET_URL}/mobile/mobile-win-nft.svg`
  }
};
