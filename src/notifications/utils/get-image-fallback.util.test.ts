import { describe, expect, it } from 'vitest';

import { DEFAULT_IMAGE_URLS, OBJKT_NOTIFICATION_IMAGE_URL } from '../default-image-fallbacks';
import { NotificationType, PlatformType } from '../notification.interface';

import { getImageFallback } from './get-image-fallback.util';

describe('getImageFallback', () => {
  it('uses the objkt icon for every account notification type', () => {
    expect(getImageFallback(PlatformType.Extension, NotificationType.OfferReceived)).toBe(OBJKT_NOTIFICATION_IMAGE_URL);
    expect(getImageFallback(PlatformType.Mobile, NotificationType.AuctionBid)).toBe(OBJKT_NOTIFICATION_IMAGE_URL);
    expect(getImageFallback(PlatformType.Extension, NotificationType.NftSold)).toBe(OBJKT_NOTIFICATION_IMAGE_URL);
  });

  it('keeps broadcast fallbacks for news, updates, and security notes', () => {
    expect(getImageFallback(PlatformType.Extension, NotificationType.News)).toBe(DEFAULT_IMAGE_URLS.extension.news);
    expect(getImageFallback(PlatformType.Mobile, NotificationType.PlatformUpdate)).toBe(
      DEFAULT_IMAGE_URLS.mobile.platformUpdate
    );
    expect(getImageFallback(PlatformType.Extension, NotificationType.SecurityNote)).toBe(
      DEFAULT_IMAGE_URLS.extension.securityNote
    );
  });
});
