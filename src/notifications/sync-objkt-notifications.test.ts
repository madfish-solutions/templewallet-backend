import { Redis } from 'ioredis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvVars } from '../config';
import { redisClient } from '../redis';
import { getAuctionBids, getNftSales, getOffersReceived } from '../utils/objkt';

import { ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY } from './account-notifications-keys';
import { addAccountNotifications } from './add-account-notifications';
import {
  startObjktNotificationsSync,
  stopObjktNotificationsSync,
  syncObjktNotifications
} from './sync-objkt-notifications';

vi.mock('../redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }
}));

vi.mock('../utils/objkt', () => ({
  getOffersReceived: vi.fn(),
  getAuctionBids: vi.fn(),
  getNftSales: vi.fn()
}));

vi.mock('./add-account-notifications', () => ({
  addAccountNotifications: vi.fn()
}));

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

const getOffers = vi.mocked(getOffersReceived);
const getBids = vi.mocked(getAuctionBids);
const getSales = vi.mocked(getNftSales);
const addNotifications = vi.mocked(addAccountNotifications);
const redis = vi.mocked(redisClient);

const mockSuccessfulLock = () => {
  redis.set.mockResolvedValue('OK');
  redis.del.mockResolvedValue(1);
};

const mockEmptyObjktPages = () => {
  getOffers.mockResolvedValue([]);
  getBids.mockResolvedValue([]);
  getSales.mockResolvedValue([]);
  addNotifications.mockResolvedValue(undefined);
};

describe('syncObjktNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
    getOffers.mockReset();
    getBids.mockReset();
    getSales.mockReset();
    addNotifications.mockReset();
    redis.get.mockReset();
    redis.set.mockReset();
    redis.del.mockReset();
    mockSuccessfulLock();
  });

  afterEach(() => {
    stopObjktNotificationsSync();
    vi.useRealTimers();
  });

  it('clamps an old cursor to the lookback window and stores an overlapped cursor', async () => {
    redis.get.mockResolvedValue('2020-01-01T00:00:00.000Z');
    getOffers.mockResolvedValue([
      {
        id: 42,
        timestamp: '2026-09-17T11:50:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        holderAddresses: ['tz1holder']
      }
    ]);
    getBids.mockResolvedValue([]);
    getSales.mockResolvedValue([]);
    addNotifications.mockResolvedValue(undefined);

    await syncObjktNotifications();

    expect(redis.set).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY, '1', 'EX', 9 * 60, 'NX');
    expect(getOffers.mock.calls[0][0]).toEqual(
      new Date(Date.parse('2026-09-17T12:00:00.000Z') - EnvVars.OBJKT_NOTIFICATIONS_LOOKBACK_MS)
    );
    expect(addNotifications).toHaveBeenCalledOnce();
    expect(addNotifications.mock.calls[0][0]).toBe(redis);
    expect(addNotifications.mock.calls[0][1][0].notification.title).toBe('New offer for 1.5 tez');
    expect(addNotifications.mock.calls[0][2]).toEqual({ publish: true });
    expect(redis.set).toHaveBeenCalledWith(
      'account-notifications-objkt-sync-at',
      new Date(Date.parse('2026-09-17T12:00:00.000Z') - 30_000).toISOString()
    );
    expect(redis.del).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY);
  });

  it('uses a stored cursor when it is inside the lookback window', async () => {
    redis.get.mockResolvedValue('2026-09-17T11:50:00.000Z');
    mockEmptyObjktPages();

    await syncObjktNotifications();

    expect(getBids.mock.calls[0][0]).toEqual(new Date('2026-09-17T11:50:00.000Z'));
    expect(addNotifications).toHaveBeenCalledWith(redis as unknown as Redis, [], { publish: true });
  });

  it('treats an invalid cursor as first boot and skips publish', async () => {
    redis.get.mockResolvedValue('not-a-date');
    mockEmptyObjktPages();

    await syncObjktNotifications();

    expect(addNotifications.mock.calls[0][2]).toEqual({ publish: false });
  });

  it('stores lookback history without publishing when there is no cursor', async () => {
    redis.get.mockResolvedValue(null);
    getOffers.mockResolvedValue([
      {
        id: 42,
        timestamp: '2026-09-17T11:50:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        holderAddresses: ['tz1holder']
      }
    ]);
    getBids.mockResolvedValue([]);
    getSales.mockResolvedValue([]);
    addNotifications.mockResolvedValue(undefined);

    await syncObjktNotifications();

    expect(getOffers.mock.calls[0][0]).toEqual(
      new Date(Date.parse('2026-09-17T12:00:00.000Z') - EnvVars.OBJKT_NOTIFICATIONS_LOOKBACK_MS)
    );
    expect(addNotifications.mock.calls[0][2]).toEqual({ publish: false });
    expect(redis.set).toHaveBeenCalledWith(
      'account-notifications-objkt-sync-at',
      new Date(Date.parse('2026-09-17T12:00:00.000Z') - 30_000).toISOString()
    );
  });

  it('skips Objkt work when another worker already holds the lock', async () => {
    redis.set.mockResolvedValue(null);
    mockEmptyObjktPages();

    await syncObjktNotifications();

    expect(redis.set).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY, '1', 'EX', 9 * 60, 'NX');
    expect(redis.get).not.toHaveBeenCalled();
    expect(getOffers).not.toHaveBeenCalled();
    expect(addNotifications).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('releases the lock and does not advance the cursor when ingest fails', async () => {
    redis.get.mockResolvedValue('2026-09-17T11:50:00.000Z');
    mockEmptyObjktPages();
    addNotifications.mockRejectedValue(new Error('redis down'));

    await expect(syncObjktNotifications()).rejects.toThrow('redis down');

    expect(redis.set).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY, '1', 'EX', 9 * 60, 'NX');
    expect(redis.set).not.toHaveBeenCalledWith('account-notifications-objkt-sync-at', expect.anything());
    expect(redis.del).toHaveBeenCalledWith(ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY);
  });

  it('unrefs the poll interval and stop clears it', async () => {
    const timeout = { unref: vi.fn() };
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockReturnValue(timeout as unknown as NodeJS.Timeout);
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    redis.get.mockResolvedValue('2026-09-17T11:50:00.000Z');
    mockEmptyObjktPages();

    const { stop } = startObjktNotificationsSync();
    startObjktNotificationsSync();

    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(timeout.unref).toHaveBeenCalledOnce();

    stop();
    expect(clearIntervalSpy).toHaveBeenCalledWith(timeout);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
