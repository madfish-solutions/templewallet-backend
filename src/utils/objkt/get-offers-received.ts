import { isDefined, safePromiseAll } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { getTokenHolders } from './get-token-holders';
import { getTokenTransfers } from './get-token-transfers';
import { holdersAtOfferTime, uniqueTokenPks } from './holders-at';
import { isCompleteObjktEvent, mapObjktCurrency, mapObjktToken } from './mappers';
import { GET_OFFERS_RECEIVED_QUERY } from './queries';
import { ObjktGraphqlEvent, ObjktGraphqlToken, ObjktOfferReceived } from './types';

interface OffersReceivedResponse {
  event: ObjktGraphqlEvent[];
}

const isOfferEvent = (
  event: ObjktGraphqlEvent
): event is ObjktGraphqlEvent & { price: number; token: ObjktGraphqlToken; token_pk: number } =>
  isCompleteObjktEvent(event) && isDefined(event.token_pk);

export const getOffersReceived = async (since: Date | string): Promise<ObjktOfferReceived[]> => {
  const events = await fetchAllObjktPages(since, async ({ since: timestamp, lastId, limit }) => {
    const data = await objktGraphql<OffersReceivedResponse>(GET_OFFERS_RECEIVED_QUERY, {
      since: timestamp,
      lastId,
      limit
    });

    return data.event;
  });
  const completeEvents = events.filter(isOfferEvent);
  const tokenPks = uniqueTokenPks(completeEvents.map(event => event.token_pk));
  const [currentHolders, transfers] = await safePromiseAll([
    getTokenHolders(tokenPks),
    getTokenTransfers(tokenPks, since)
  ]);

  return completeEvents.map(event => ({
    id: event.id,
    timestamp: event.timestamp,
    token: mapObjktToken(event.token),
    amount: event.price,
    currency: mapObjktCurrency(event.currency),
    holderAddresses: holdersAtOfferTime({
      tokenPk: event.token_pk,
      at: event.timestamp,
      creatorAddress: event.creator_address,
      currentHolders,
      transfers
    })
  }));
};
