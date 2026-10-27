import { isDefined, isNonEmptyString, safePromiseAll } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { getTokenHolders } from './get-token-holders';
import { getTokenMovements } from './get-token-movements';
import { holdersAtOfferTime, uniqueTokenPks } from './holders-at';
import { isCompleteObjktEvent, mapObjktCurrency, mapObjktToken } from './mappers';
import { GET_OFFERS_RECEIVED_QUERY } from './queries';
import { getSameBlockMovementsAfterOffers, SameBlockOffer } from './same-block-movements';
import { ObjktGraphqlEvent, ObjktGraphqlToken, ObjktOfferReceived, ObjktTokenMovement } from './types';

interface OffersReceivedResponse {
  event: ObjktGraphqlEvent[];
}

const isOfferEvent = (
  event: ObjktGraphqlEvent
): event is ObjktGraphqlEvent & { price: number; token: ObjktGraphqlToken; token_pk: number } =>
  isCompleteObjktEvent(event) && isDefined(event.token_pk);

const sharesOfferTimestamp = (movement: ObjktTokenMovement, offer: ObjktGraphqlEvent) =>
  movement.tokenPk === offer.token_pk && Date.parse(movement.timestamp) === Date.parse(offer.timestamp);

const toSameBlockOffer = (
  event: ObjktGraphqlEvent & { token: ObjktGraphqlToken; token_pk: number }
): SameBlockOffer => {
  if (!isNonEmptyString(event.ophash) || !isDefined(event.level)) {
    throw new Error(`Objkt offer ${event.id} cannot be ordered within its block`);
  }

  return {
    id: event.id,
    level: event.level,
    ophash: event.ophash,
    timestamp: event.timestamp,
    tokenPk: event.token_pk,
    faContract: event.token.fa_contract,
    tokenId: event.token.token_id
  };
};

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
  const [currentHolders, movements] = await safePromiseAll([
    getTokenHolders(tokenPks),
    getTokenMovements(tokenPks, since)
  ]);
  const sameBlockOffers = completeEvents
    .filter(event => movements.some(movement => sharesOfferTimestamp(movement, event)))
    .map(toSameBlockOffer);
  const sameBlockMovementsAfter =
    sameBlockOffers.length === 0 ? new Map() : await getSameBlockMovementsAfterOffers(sameBlockOffers);

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
      movements,
      sameBlockMovementsAfter: sameBlockMovementsAfter.get(event.id) ?? []
    })
  }));
};
