import { describe, expect, it } from 'vitest';

import {
  AccountNotificationConnection,
  AccountNotificationsHub,
  parseAccountNotificationEvents
} from './account-notifications-hub';
import { AccountNotification, NotificationType, PlatformType } from './notification.interface';

const TZ1_A = 'tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A';
const TZ1_B = 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';

const createSink = () => {
  const sent: unknown[] = [];
  const connection: AccountNotificationConnection = {
    send: payload => {
      sent.push(payload);
    }
  };

  return { connection, sent };
};

const offer = (id: number, accountAddresses: string[]): AccountNotification => ({
  id,
  createdAt: '2020-01-01T00:00:00.000Z',
  type: NotificationType.OfferReceived,
  platforms: [PlatformType.Mobile, PlatformType.Extension],
  language: 'en-US',
  title: 'New offer for 1 tez',
  description: 'On Tezzard',
  content: ['On Tezzard'],
  extensionImageUrl: 'https://icon.test',
  mobileImageUrl: 'https://icon.test',
  accountAddresses
});

describe('AccountNotificationsHub', () => {
  it('fans a notification out once per connection with only matching addresses', () => {
    const hub = new AccountNotificationsHub();
    const first = createSink();
    const second = createSink();

    hub.setAccountAddresses(first.connection, [TZ1_A, TZ1_B]);
    hub.setAccountAddresses(second.connection, [TZ1_B]);
    hub.dispatch(offer(1, [TZ1_A, TZ1_B]));

    expect(first.sent).toEqual([{ type: 'notification', notification: offer(1, [TZ1_A, TZ1_B]) }]);
    expect(second.sent).toEqual([{ type: 'notification', notification: offer(1, [TZ1_B]) }]);
  });

  it('retargets a connection without dropping it', () => {
    const hub = new AccountNotificationsHub();
    const sink = createSink();

    hub.setAccountAddresses(sink.connection, [TZ1_A]);
    hub.setAccountAddresses(sink.connection, [TZ1_B]);
    hub.dispatch(offer(1, [TZ1_A]));
    hub.dispatch(offer(2, [TZ1_B]));

    expect(sink.sent).toEqual([{ type: 'notification', notification: offer(2, [TZ1_B]) }]);
  });

  it('stops sending after a connection is removed', () => {
    const hub = new AccountNotificationsHub();
    const sink = createSink();

    hub.setAccountAddresses(sink.connection, [TZ1_A]);
    hub.removeConnection(sink.connection);
    hub.dispatch(offer(1, [TZ1_A]));

    expect(sink.sent).toEqual([]);
  });
});

describe('parseAccountNotificationEvents', () => {
  it('keeps well-formed account notifications and ignores junk', () => {
    const valid = offer(7, [TZ1_A]);

    expect(parseAccountNotificationEvents(JSON.stringify([valid, { type: 'News' }, 'nope']))).toEqual([valid]);
    expect(parseAccountNotificationEvents('{')).toEqual([]);
    expect(parseAccountNotificationEvents(JSON.stringify(valid))).toEqual([]);
  });
});
