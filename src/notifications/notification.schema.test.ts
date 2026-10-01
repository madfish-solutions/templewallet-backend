import { describe, expect, it } from 'vitest';

import { NotificationType, PlatformType } from './notification.interface';
import {
  accountNotificationEventSchema,
  accountNotificationEventsSchema,
  storedAccountNotificationSchema
} from './notification.schema';

const storedNotification = {
  id: 7,
  createdAt: '2020-01-01T00:00:00.000Z',
  type: NotificationType.OfferReceived,
  platforms: [PlatformType.Mobile, PlatformType.Extension],
  language: 'en-US',
  title: 'New offer for 1 tez',
  description: 'On Tezzard',
  content: ['On Tezzard'],
  extensionImageUrl: 'https://icon.test',
  mobileImageUrl: 'https://icon.test'
};

describe('storedAccountNotificationSchema', () => {
  it('accepts account notifications and rejects broadcast types and junk', () => {
    expect(storedAccountNotificationSchema.isValidSync(storedNotification)).toBe(true);
    expect(
      storedAccountNotificationSchema.isValidSync({
        ...storedNotification,
        content: [{ text: 'Open', url: 'https://objkt.com' }]
      })
    ).toBe(true);
    expect(storedAccountNotificationSchema.isValidSync({ ...storedNotification, type: NotificationType.News })).toBe(
      false
    );
    expect(storedAccountNotificationSchema.isValidSync(null)).toBe(false);
    expect(storedAccountNotificationSchema.isValidSync('{')).toBe(false);
  });
});

describe('accountNotificationEventSchema', () => {
  it('requires non-empty account addresses', () => {
    expect(accountNotificationEventSchema.isValidSync(storedNotification)).toBe(false);
    expect(accountNotificationEventSchema.isValidSync({ ...storedNotification, accountAddresses: ['tz1holder'] })).toBe(
      true
    );
    expect(accountNotificationEventSchema.isValidSync({ ...storedNotification, accountAddresses: [''] })).toBe(false);
  });
});

describe('accountNotificationEventsSchema', () => {
  it('keeps well-formed events and drops junk instead of failing the batch', () => {
    const valid = { ...storedNotification, accountAddresses: ['tz1holder'] };

    expect(accountNotificationEventsSchema.validateSync([valid, { type: 'News' }, 'nope'])).toEqual([valid]);
    expect(accountNotificationEventsSchema.validateSync(valid)).toEqual([]);
  });
});
