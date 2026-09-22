import { Redis } from 'ioredis';

import { EnvVars } from '../config';
import { isDefined, isNonEmptyString } from '../utils/helpers';

import {
  ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL,
  getAccountNotificationIndexKey,
  getAccountNotificationKey,
  getIndexTrimRank
} from './account-notifications-keys';
import {
  AccountNotification,
  AccountNotificationType,
  isAccountNotificationType,
  Notification,
  PlatformType
} from './notification.interface';

export interface AccountNotificationInput {
  notification: Omit<Notification, 'platforms' | 'type'> & { type: AccountNotificationType };
  accountAddresses: string[];
}

interface PendingAccountNotification {
  event: AccountNotification;
  commandStart: number;
  commandCount: number;
}

const getPayloadTtlSeconds = (notification: Notification, now: number) => {
  let ttlSeconds = EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS;

  if (isNonEmptyString(notification.expirationDate)) {
    const expirationTtlSeconds = Math.floor((new Date(notification.expirationDate).getTime() - now) / 1000);
    if (expirationTtlSeconds <= 0) {
      return undefined;
    }

    ttlSeconds = Math.min(ttlSeconds, expirationTtlSeconds);
  }

  return ttlSeconds;
};

const getReplyError = (reply: [Error | null, unknown] | undefined) => {
  if (!isDefined(reply) || !isDefined(reply[0])) {
    return undefined;
  }

  return reply[0];
};

const collectPipelineOutcome = (pendingEvents: PendingAccountNotification[], replies: [Error | null, unknown][]) => {
  const newlyStoredEvents: AccountNotification[] = [];
  const commandErrors: Error[] = [];

  for (const pending of pendingEvents) {
    const itemReplies = replies.slice(pending.commandStart, pending.commandStart + pending.commandCount);
    const setReply = itemReplies[0];
    const itemError = itemReplies.map(getReplyError).find(isDefined);

    if (isDefined(itemError)) {
      commandErrors.push(itemError);
    }

    if (!isDefined(getReplyError(setReply)) && isDefined(setReply) && setReply[1] === 'OK') {
      newlyStoredEvents.push(pending.event);
    }
  }

  return { newlyStoredEvents, commandErrors };
};

export interface AddAccountNotificationsOptions {
  publish?: boolean;
}

export const addAccountNotifications = async (
  client: Redis,
  items: AccountNotificationInput[],
  options: AddAccountNotificationsOptions = {}
) => {
  if (items.length === 0) {
    return;
  }

  const now = Date.now();
  const pipeline = client.pipeline();
  const indexTrimRank = getIndexTrimRank(EnvVars.ACCOUNT_NOTIFICATION_INDEX_CAP);
  const pendingEvents: PendingAccountNotification[] = [];
  let queuedCommands = 0;

  for (const { notification, accountAddresses } of items) {
    if (!isAccountNotificationType(notification.type)) {
      throw new Error(`Unsupported account notification type: ${notification.type}`);
    }

    if (accountAddresses.length === 0) {
      continue;
    }

    const storedNotification: Notification = {
      ...notification,
      platforms: [PlatformType.Mobile, PlatformType.Extension]
    };
    const ttlSeconds = getPayloadTtlSeconds(storedNotification, now);
    if (ttlSeconds === undefined) {
      continue;
    }

    const createdAtTimestamp = new Date(storedNotification.createdAt).getTime();
    const payloadKey = getAccountNotificationKey(storedNotification.id);
    const notificationId = String(storedNotification.id);
    const commandStart = queuedCommands;

    pipeline.set(payloadKey, JSON.stringify(storedNotification), 'EX', ttlSeconds, 'NX');
    queuedCommands += 1;

    for (const address of accountAddresses) {
      const indexKey = getAccountNotificationIndexKey(address);
      pipeline.zadd(indexKey, createdAtTimestamp, notificationId);
      pipeline.expire(indexKey, EnvVars.ACCOUNT_NOTIFICATION_TTL_SECONDS);
      pipeline.zremrangebyrank(indexKey, 0, indexTrimRank);
      queuedCommands += 3;
    }

    pendingEvents.push({
      event: {
        ...storedNotification,
        type: notification.type,
        accountAddresses
      },
      commandStart,
      commandCount: queuedCommands - commandStart
    });
  }

  const replies = await pipeline.exec();
  if (!isDefined(replies) || replies.length < queuedCommands) {
    throw new Error('Account notifications Redis pipeline returned an incomplete result');
  }

  const { newlyStoredEvents, commandErrors } = collectPipelineOutcome(pendingEvents, replies);
  const shouldPublish = options.publish ?? true;

  if (shouldPublish && newlyStoredEvents.length > 0) {
    await client.publish(ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL, JSON.stringify(newlyStoredEvents));
  }

  if (commandErrors.length > 0) {
    throw commandErrors[0];
  }
};
