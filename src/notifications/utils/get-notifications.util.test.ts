import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { Notification, NotificationType, PlatformType } from '../notification.interface';

import { getNotifications } from './get-notifications.util';

const PAST = '2020-01-01T00:00:00.000Z';
const SAME_TIME = '2020-01-01T01:00:00.000Z';
const LATER = '2020-01-01T02:00:00.000Z';

const notification = (overrides: Partial<Notification> & Pick<Notification, 'id'>): string =>
  JSON.stringify({
    createdAt: PAST,
    type: NotificationType.News,
    platforms: [PlatformType.Extension],
    language: 'en-US',
    title: 'title',
    description: 'description',
    content: ['description'],
    extensionImageUrl: 'https://icon.test',
    mobileImageUrl: 'https://icon.test',
    ...overrides
  });

describe('getNotifications', () => {
  it('returns later items for the requested platform and ignores id on the time cursor', async () => {
    const redis = {
      lrange: vi.fn(async () => [
        notification({ id: 1, createdAt: PAST }),
        notification({ id: 2, createdAt: SAME_TIME }),
        notification({ id: Date.parse(LATER), createdAt: LATER }),
        notification({
          id: Date.parse(LATER) + 1,
          createdAt: LATER,
          platforms: [PlatformType.Mobile]
        })
      ]),
      lrem: vi.fn()
    };

    const results = await getNotifications(redis as unknown as Redis, PlatformType.Extension, Date.parse(SAME_TIME));

    expect(results.map(item => item.id)).toEqual([Date.parse(LATER)]);
    expect(redis.lrem).not.toHaveBeenCalled();
  });

  it('keeps mandatory notifications even when they are not after startFromTime', async () => {
    const redis = {
      lrange: vi.fn(async () => [notification({ id: 1, createdAt: PAST, isMandatory: true })]),
      lrem: vi.fn()
    };

    const results = await getNotifications(redis as unknown as Redis, PlatformType.Extension, Date.now());

    expect(results.map(item => item.id)).toEqual([1]);
  });

  it('removes expired list items', async () => {
    const expired = {
      id: 1,
      createdAt: PAST,
      type: NotificationType.News,
      platforms: [PlatformType.Extension],
      language: 'en-US',
      title: 'title',
      description: 'description',
      content: ['description'],
      extensionImageUrl: 'https://icon.test',
      mobileImageUrl: 'https://icon.test',
      expirationDate: '2019-01-01T00:00:00.000Z'
    };
    const redis = {
      lrange: vi.fn(async () => [JSON.stringify(expired)]),
      lrem: vi.fn()
    };

    await expect(getNotifications(redis as unknown as Redis, PlatformType.Extension, 0)).resolves.toEqual([]);
    expect(redis.lrem).toHaveBeenCalledWith('notifications', 1, JSON.stringify(expired));
  });
});
