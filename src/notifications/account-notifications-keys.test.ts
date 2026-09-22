import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_NOTIFICATIONS_INDEX_PREFIX,
  ACCOUNT_NOTIFICATIONS_PREFIX,
  getAccountNotificationIndexKey,
  getAccountNotificationKey,
  getIndexTrimRank
} from './account-notifications-keys';

describe('account notification keys', () => {
  it('builds payload and index keys from the shared prefix', () => {
    expect(getAccountNotificationKey(42)).toBe(`${ACCOUNT_NOTIFICATIONS_PREFIX}:42`);
    expect(getAccountNotificationKey('42')).toBe(`${ACCOUNT_NOTIFICATIONS_PREFIX}:42`);
    expect(getAccountNotificationIndexKey('tz1abc')).toBe(`${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}tz1abc`);
  });

  it('keeps the newest cap members by trimming rank 0 through -(cap + 1)', () => {
    expect(getIndexTrimRank(100)).toBe(-101);
    expect(getIndexTrimRank(50)).toBe(-51);
  });
});
