export const ACCOUNT_NOTIFICATIONS_PREFIX = 'account-notifications';
export const ACCOUNT_NOTIFICATIONS_INDEX_PREFIX = `${ACCOUNT_NOTIFICATIONS_PREFIX}:index:`;
export const ACCOUNT_NOTIFICATIONS_CLEANUP_LOCK_KEY = 'account-notifications-cleanup-lock';
export const ACCOUNT_NOTIFICATIONS_SYNC_LOCK_KEY = 'account-notifications-objkt-sync-lock';
export const ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL = 'account-notifications-events';

export const getAccountNotificationKey = (id: number | string) => `${ACCOUNT_NOTIFICATIONS_PREFIX}:${id}`;

export const getAccountNotificationIndexKey = (address: string) => `${ACCOUNT_NOTIFICATIONS_INDEX_PREFIX}${address}`;

export const getIndexTrimRank = (cap: number) => -(cap + 1);
