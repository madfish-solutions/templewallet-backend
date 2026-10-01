import { describe, expect, it } from 'vitest';

import { isAccountNotificationType, NotificationType } from './notification.interface';

describe('isAccountNotificationType', () => {
  it('accepts objkt account types and rejects broadcast types', () => {
    expect(isAccountNotificationType(NotificationType.OfferReceived)).toBe(true);
    expect(isAccountNotificationType(NotificationType.AuctionBid)).toBe(true);
    expect(isAccountNotificationType(NotificationType.NftSold)).toBe(true);
    expect(isAccountNotificationType(NotificationType.News)).toBe(false);
    expect(isAccountNotificationType(NotificationType.PlatformUpdate)).toBe(false);
    expect(isAccountNotificationType(NotificationType.SecurityNote)).toBe(false);
  });
});
