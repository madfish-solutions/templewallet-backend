import { isDefined, isNonEmptyString } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { GET_TOKEN_MOVEMENTS_QUERY } from './queries';
import { ObjktGraphqlEvent, ObjktTokenMovement } from './types';

interface TokenMovementsResponse {
  event: ObjktGraphqlEvent[];
}

const toPositiveAmount = (amount: number | null | undefined) =>
  isDefined(amount) && Number.isFinite(amount) && amount > 0 ? amount : undefined;

const mapTokenMovement = (event: ObjktGraphqlEvent): ObjktTokenMovement | undefined => {
  const amount = toPositiveAmount(event.amount);
  if (!isDefined(event.token_pk) || !isDefined(amount)) {
    return undefined;
  }

  if (event.event_type === 'mint') {
    const recipient = isNonEmptyString(event.recipient_address) ? event.recipient_address : event.creator_address;
    if (!isNonEmptyString(recipient)) {
      return undefined;
    }

    return {
      tokenPk: event.token_pk,
      timestamp: event.timestamp,
      amount,
      recipient
    };
  }

  if (event.event_type !== 'transfer' || !isNonEmptyString(event.creator_address)) {
    return undefined;
  }

  return {
    tokenPk: event.token_pk,
    timestamp: event.timestamp,
    amount,
    sender: event.creator_address,
    recipient: isNonEmptyString(event.recipient_address) ? event.recipient_address : undefined
  };
};

export const getTokenMovements = async (tokenPks: number[], since: Date | string): Promise<ObjktTokenMovement[]> => {
  if (tokenPks.length === 0) {
    return [];
  }

  const events = await fetchAllObjktPages(since, async ({ since: timestamp, lastId, limit }) => {
    const data = await objktGraphql<TokenMovementsResponse>(GET_TOKEN_MOVEMENTS_QUERY, {
      tokenPks,
      since: timestamp,
      lastId,
      limit
    });

    return data.event;
  });

  return events.map(mapTokenMovement).filter(isDefined);
};
