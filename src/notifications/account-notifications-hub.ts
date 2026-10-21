import { isDefined } from '../utils/helpers';

import { AccountNotification } from './notification.interface';
import { accountNotificationEventsSchema } from './notification.schema';

export interface AccountNotificationConnection {
  send(payload: unknown): void;
}

export const parseAccountNotificationEvents = (message: string): AccountNotification[] => {
  try {
    return accountNotificationEventsSchema.validateSync(JSON.parse(message), { stripUnknown: true });
  } catch {
    return [];
  }
};

export class AccountNotificationsHub {
  private readonly connectionsByAddress = new Map<string, Set<AccountNotificationConnection>>();
  private readonly addressesByConnection = new Map<AccountNotificationConnection, Set<string>>();

  setAccountAddresses(connection: AccountNotificationConnection, accountAddresses: string[]) {
    const nextAddresses = Array.from(new Set(accountAddresses));
    const previousAddresses = this.addressesByConnection.get(connection) ?? new Set<string>();
    const nextAddressSet = new Set(nextAddresses);

    for (const address of previousAddresses) {
      if (!nextAddressSet.has(address)) {
        this.removeConnectionFromAddress(connection, address);
      }
    }

    for (const address of nextAddressSet) {
      if (!previousAddresses.has(address)) {
        this.addConnectionToAddress(connection, address);
      }
    }

    this.addressesByConnection.set(connection, nextAddressSet);

    return nextAddresses;
  }

  removeConnection(connection: AccountNotificationConnection) {
    const addresses = this.addressesByConnection.get(connection);
    if (!isDefined(addresses)) {
      return;
    }

    for (const address of addresses) {
      this.removeConnectionFromAddress(connection, address);
    }

    this.addressesByConnection.delete(connection);
  }

  dispatch(notification: AccountNotification) {
    const sentConnections = new Set<AccountNotificationConnection>();

    for (const address of notification.accountAddresses) {
      const connections = this.connectionsByAddress.get(address);
      if (!isDefined(connections)) {
        continue;
      }

      for (const connection of connections) {
        if (sentConnections.has(connection)) {
          continue;
        }

        sentConnections.add(connection);
        const subscribedAddresses = this.addressesByConnection.get(connection);
        if (!isDefined(subscribedAddresses)) {
          continue;
        }

        const matchingAddresses = notification.accountAddresses.filter(accountAddress =>
          subscribedAddresses.has(accountAddress)
        );
        if (matchingAddresses.length === 0) {
          continue;
        }

        connection.send({
          type: 'notification',
          notification: {
            ...notification,
            accountAddresses: matchingAddresses
          }
        });
      }
    }
  }

  dispatchMessage(message: string) {
    for (const notification of parseAccountNotificationEvents(message)) {
      this.dispatch(notification);
    }
  }

  private addConnectionToAddress(connection: AccountNotificationConnection, address: string) {
    const connections = this.connectionsByAddress.get(address);
    if (isDefined(connections)) {
      connections.add(connection);

      return;
    }

    this.connectionsByAddress.set(address, new Set([connection]));
  }

  private removeConnectionFromAddress(connection: AccountNotificationConnection, address: string) {
    const connections = this.connectionsByAddress.get(address);
    if (!isDefined(connections)) {
      return;
    }

    connections.delete(connection);
    if (connections.size === 0) {
      this.connectionsByAddress.delete(address);
    }
  }
}
