import { IncomingMessage, Server } from 'http';
import { Redis } from 'ioredis';
import { Duplex } from 'stream';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import * as yup from 'yup';

import { EnvVars } from '../config';
import { isDefined, isNonEmptyString } from '../utils/helpers';
import logger from '../utils/logger';

import { accountAddressesSchema } from './account-addresses.schema';
import { AccountNotificationConnection, AccountNotificationsHub } from './account-notifications-hub';
import { ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL } from './account-notifications-keys';

export const ACCOUNT_NOTIFICATIONS_WS_PATH = '/api/notifications';
const MAX_WS_PAYLOAD_BYTES = 64 * 1024;

const setAccountAddressesMessageSchema = yup
  .object({
    type: yup.string().oneOf(['setAccountAddresses']).required(),
    accountAddresses: accountAddressesSchema
  })
  .required();

export interface AccountNotificationsWsOptions {
  hub?: AccountNotificationsHub;
  redis?: Redis;
  heartbeatMs?: number;
}

const getRequestPathname = (request: IncomingMessage) => {
  if (!isNonEmptyString(request.url)) {
    return '';
  }

  return new URL(request.url, 'http://127.0.0.1').pathname;
};

const rawDataToString = (data: RawData) => {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }

  return Buffer.from(data).toString('utf8');
};

const sendJson = (socket: WebSocket, payload: unknown) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const startAccountNotificationsSubscriber = (redis: Redis, hub: AccountNotificationsHub) => {
  const subscriber = redis.duplicate();
  subscriber.on('error', error => logger.error(error));
  void subscriber.subscribe(ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL).catch(error => {
    logger.error('Failed to subscribe to account notification events', error);
  });
  subscriber.on('message', (channel, message) => {
    if (channel !== ACCOUNT_NOTIFICATIONS_EVENTS_CHANNEL || !isNonEmptyString(message)) {
      return;
    }

    hub.dispatchMessage(message);
  });

  return subscriber;
};

export const attachAccountNotificationsWebSocket = (server: Server, options: AccountNotificationsWsOptions = {}) => {
  const hub = options.hub ?? new AccountNotificationsHub();
  const heartbeatMs = options.heartbeatMs ?? EnvVars.ACCOUNT_NOTIFICATIONS_WS_HEARTBEAT_MS;
  const subscriber = isDefined(options.redis) ? startAccountNotificationsSubscriber(options.redis, hub) : undefined;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES });
  const isAlive = new WeakMap<WebSocket, boolean>();

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (getRequestPathname(request) !== ACCOUNT_NOTIFICATIONS_WS_PATH) {
      socket.destroy();

      return;
    }

    wss.handleUpgrade(request, socket, head, websocket => {
      wss.emit('connection', websocket, request);
    });
  };

  server.on('upgrade', onUpgrade);

  wss.on('connection', (socket: WebSocket) => {
    const connection: AccountNotificationConnection = {
      send: payload => sendJson(socket, payload)
    };

    isAlive.set(socket, true);
    hub.setAccountAddresses(connection, []);
    sendJson(socket, { type: 'subscribed', accountAddresses: [] });

    socket.on('pong', () => {
      isAlive.set(socket, true);
    });

    socket.on('message', data => {
      try {
        const parsed: unknown = JSON.parse(rawDataToString(data));
        const message = setAccountAddressesMessageSchema.validateSync(parsed, {
          abortEarly: false,
          stripUnknown: true
        });
        const accountAddresses = hub.setAccountAddresses(
          connection,
          Array.from(message.accountAddresses ?? []).filter(isNonEmptyString)
        );
        sendJson(socket, { type: 'subscribed', accountAddresses });
      } catch (error: unknown) {
        const details = error instanceof yup.ValidationError ? error.errors : undefined;
        sendJson(socket, {
          type: 'error',
          message: 'Invalid message',
          details
        });
      }
    });

    socket.on('close', () => {
      hub.removeConnection(connection);
    });
  });

  const heartbeatInterval =
    heartbeatMs > 0
      ? setInterval(() => {
          for (const client of wss.clients) {
            if (isAlive.get(client) !== true) {
              client.terminate();
              continue;
            }

            isAlive.set(client, false);
            client.ping();
          }
        }, heartbeatMs)
      : undefined;

  heartbeatInterval?.unref();

  return {
    close: async () => {
      if (isDefined(heartbeatInterval)) {
        clearInterval(heartbeatInterval);
      }

      server.off('upgrade', onUpgrade);

      await new Promise<void>((resolve, reject) => {
        wss.close(error => {
          if (isDefined(error)) {
            reject(error);

            return;
          }

          resolve();
        });
      });

      if (isDefined(subscriber)) {
        subscriber.disconnect();
      }
    }
  };
};
