import { createServer, Server } from 'http';
import { Redis } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import { isDefined } from '../utils/helpers';

import { AccountNotificationsHub } from './account-notifications-hub';
import { ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL } from './account-notifications-keys';
import { ACCOUNT_NOTIFICATIONS_WS_PATH, attachAccountNotificationsWebSocket } from './account-notifications-ws';
import { AccountNotification, NotificationType, PlatformType } from './notification.interface';

const TZ1_A = 'tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A';
const TZ1_B = 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';

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

const connect = async (url: string) => {
  const socket = new WebSocket(url);
  const queued: unknown[] = [];
  let pending: ((value: unknown) => void) | undefined;

  socket.on('message', data => {
    const parsed: unknown = JSON.parse(data.toString());
    if (isDefined(pending)) {
      const resolve = pending;
      pending = undefined;
      resolve(parsed);
    } else {
      queued.push(parsed);
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });

  const nextMessage = () => {
    const queuedMessage = queued.shift();
    if (isDefined(queuedMessage)) {
      return Promise.resolve(queuedMessage);
    }

    return new Promise<unknown>(resolve => {
      pending = resolve;
    });
  };

  return { socket, nextMessage };
};

const closeSocket = (socket: WebSocket) =>
  new Promise<void>(resolve => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();

      return;
    }

    socket.once('close', () => resolve());
    socket.close();
  });

describe('attachAccountNotificationsWebSocket', () => {
  let server: Server | undefined;
  let closeAttached: (() => Promise<void>) | undefined;
  let sockets: WebSocket[] = [];

  afterEach(async () => {
    await Promise.all(sockets.map(closeSocket));
    sockets = [];

    if (isDefined(closeAttached)) {
      await closeAttached();
      closeAttached = undefined;
    }

    if (isDefined(server)) {
      const listeningServer = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => {
        listeningServer.close(error => {
          if (isDefined(error)) {
            reject(error);

            return;
          }

          resolve();
        });
      });
    }
  });

  const startServer = async ({
    hub = new AccountNotificationsHub(),
    redis
  }: {
    hub?: AccountNotificationsHub;
    redis?: Redis;
  } = {}) => {
    const httpServer = createServer();
    const attached = attachAccountNotificationsWebSocket(httpServer, { hub, redis, heartbeatMs: 0 });
    await new Promise<void>(resolve => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const address = httpServer.address();
    if (!isDefined(address) || typeof address === 'string') {
      throw new Error('Expected a TCP listen address');
    }

    server = httpServer;
    closeAttached = attached.close;

    return { hub, port: address.port };
  };

  it('keeps the socket and retargets the account list', async () => {
    const { hub, port } = await startServer();
    const { socket, nextMessage } = await connect(`ws://127.0.0.1:${port}${ACCOUNT_NOTIFICATIONS_WS_PATH}`);
    sockets.push(socket);

    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [] });

    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: [TZ1_A] }));
    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [TZ1_A] });

    hub.dispatch(offer(1, [TZ1_A]));
    await expect(nextMessage()).resolves.toEqual({
      type: 'notification',
      notification: offer(1, [TZ1_A])
    });

    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: [TZ1_B] }));
    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [TZ1_B] });

    hub.dispatch(offer(2, [TZ1_A]));
    hub.dispatch(offer(3, [TZ1_B]));
    await expect(nextMessage()).resolves.toEqual({
      type: 'notification',
      notification: offer(3, [TZ1_B])
    });
  });

  it('rejects an invalid account list without closing the socket', async () => {
    const { port } = await startServer();
    const { socket, nextMessage } = await connect(`ws://127.0.0.1:${port}${ACCOUNT_NOTIFICATIONS_WS_PATH}`);
    sockets.push(socket);

    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [] });

    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: ['not-an-address'] }));
    await expect(nextMessage()).resolves.toMatchObject({
      type: 'error',
      message: 'Invalid message'
    });

    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: [TZ1_A] }));
    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [TZ1_A] });
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });

  it('rejects invalid JSON without closing the socket', async () => {
    const { port } = await startServer();
    const { socket, nextMessage } = await connect(`ws://127.0.0.1:${port}${ACCOUNT_NOTIFICATIONS_WS_PATH}`);
    sockets.push(socket);

    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [] });

    socket.send('not-json');
    await expect(nextMessage()).resolves.toMatchObject({
      type: 'error',
      message: 'Invalid message'
    });
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });

  it('rejects websocket upgrades on a different path', async () => {
    const { port } = await startServer();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/other`);
    sockets.push(socket);

    await expect(
      new Promise<string>(resolve => {
        socket.once('close', () => resolve('close'));
        socket.once('error', () => resolve('error'));
      })
    ).resolves.toMatch(/error|close/);
  });

  it('stops delivering notifications after the socket closes', async () => {
    const { hub, port } = await startServer();
    const { socket, nextMessage } = await connect(`ws://127.0.0.1:${port}${ACCOUNT_NOTIFICATIONS_WS_PATH}`);
    sockets.push(socket);

    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [] });
    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: [TZ1_A] }));
    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [TZ1_A] });

    await closeSocket(socket);
    sockets = sockets.filter(openSocket => openSocket !== socket);

    hub.dispatch(offer(1, [TZ1_A]));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(socket.readyState).toBe(WebSocket.CLOSED);
  });

  it('fans a redis pub/sub payload to subscribed sockets and disconnects on close', async () => {
    const handlers = new Map<string, (channel: string, message: string) => void>();
    const subscriber = {
      on: (event: string, handler: (channel: string, message: string) => void) => {
        handlers.set(event, handler);
      },
      subscribe: vi.fn(async () => 1),
      disconnect: vi.fn()
    };
    const redis = { duplicate: () => subscriber };

    const { port } = await startServer({ redis: redis as unknown as Redis });
    const { socket, nextMessage } = await connect(`ws://127.0.0.1:${port}${ACCOUNT_NOTIFICATIONS_WS_PATH}`);
    sockets.push(socket);

    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [] });
    socket.send(JSON.stringify({ type: 'setAccountAddresses', accountAddresses: [TZ1_A] }));
    await expect(nextMessage()).resolves.toEqual({ type: 'subscribed', accountAddresses: [TZ1_A] });

    const onMessage = handlers.get('message');
    expect(onMessage).toBeDefined();
    onMessage?.('other-channel', JSON.stringify([offer(8, [TZ1_A])]));
    onMessage?.(ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL, '');
    onMessage?.(ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL, JSON.stringify([offer(9, [TZ1_A])]));

    await expect(nextMessage()).resolves.toEqual({
      type: 'notification',
      notification: offer(9, [TZ1_A])
    });

    await closeSocket(socket);
    sockets = sockets.filter(openSocket => openSocket !== socket);

    if (isDefined(closeAttached)) {
      await closeAttached();
      closeAttached = undefined;
    }

    expect(subscriber.disconnect).toHaveBeenCalledOnce();
  });
});
