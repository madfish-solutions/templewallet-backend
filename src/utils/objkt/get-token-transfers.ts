import { isDefined, isNonEmptyString } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { GET_TOKEN_TRANSFERS_QUERY } from './queries';
import { ObjktGraphqlEvent, ObjktTokenTransfer } from './types';

interface TokenTransfersResponse {
  event: ObjktGraphqlEvent[];
}

const mapTokenTransfer = (event: ObjktGraphqlEvent): ObjktTokenTransfer | undefined => {
  if (
    !isDefined(event.token_pk) ||
    !isDefined(event.amount) ||
    event.amount <= 0 ||
    !isNonEmptyString(event.creator_address) ||
    !isNonEmptyString(event.recipient_address)
  ) {
    return undefined;
  }

  return {
    id: event.id,
    tokenPk: event.token_pk,
    timestamp: event.timestamp,
    amount: event.amount,
    sender: event.creator_address,
    recipient: event.recipient_address
  };
};

export const getTokenTransfers = async (tokenPks: number[], since: Date | string): Promise<ObjktTokenTransfer[]> => {
  if (tokenPks.length === 0) {
    return [];
  }

  const events = await fetchAllObjktPages(since, async ({ since: timestamp, lastId, limit }) => {
    const data = await objktGraphql<TokenTransfersResponse>(GET_TOKEN_TRANSFERS_QUERY, {
      tokenPks,
      since: timestamp,
      lastId,
      limit
    });

    return data.event;
  });

  return events.map(mapTokenTransfer).filter(isDefined);
};
