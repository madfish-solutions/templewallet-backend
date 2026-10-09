import { isDefined } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { isCompleteObjktEvent, mapObjktCurrency, mapObjktToken } from './mappers';
import { GET_AUCTION_BIDS_QUERY } from './queries';
import { ObjktAuctionBid, ObjktGraphqlEvent } from './types';

interface AuctionBidsResponse {
  event: ObjktGraphqlEvent[];
}

const mapAuctionBid = (event: ObjktGraphqlEvent): ObjktAuctionBid | undefined => {
  if (!isCompleteObjktEvent(event) || !isDefined(event.recipient_address)) {
    return undefined;
  }

  return {
    id: event.id,
    timestamp: event.timestamp,
    token: mapObjktToken(event.token),
    amount: event.price,
    currency: mapObjktCurrency(event.currency),
    sellerAddress: event.recipient_address
  };
};

export const getAuctionBids = async (since: Date | string): Promise<ObjktAuctionBid[]> => {
  const events = await fetchAllObjktPages(since, async ({ since: timestamp, lastId, limit }) => {
    const data = await objktGraphql<AuctionBidsResponse>(GET_AUCTION_BIDS_QUERY, {
      since: timestamp,
      lastId,
      limit
    });

    return data.event;
  });

  return events.map(mapAuctionBid).filter(isDefined);
};
