import { isDefined } from '../helpers';

import { fetchAllObjktPages, objktGraphql } from './client';
import { isCompleteObjktEvent, mapObjktCurrency, mapObjktToken } from './mappers';
import { GET_NFT_SALES_QUERY } from './queries';
import { ObjktGraphqlEvent, ObjktNftSold } from './types';

interface NftSalesResponse {
  event: ObjktGraphqlEvent[];
}

const mapNftSold = (event: ObjktGraphqlEvent): ObjktNftSold | undefined => {
  if (!isCompleteObjktEvent(event) || !isDefined(event.creator_address)) {
    return undefined;
  }

  return {
    id: event.id,
    timestamp: event.timestamp,
    token: mapObjktToken(event.token),
    amount: event.price,
    currency: mapObjktCurrency(event.currency),
    sellerAddress: event.creator_address
  };
};

export const getNftSales = async (since: Date | string): Promise<ObjktNftSold[]> => {
  const events = await fetchAllObjktPages(since, async ({ since: timestamp, lastId, limit }) => {
    const data = await objktGraphql<NftSalesResponse>(GET_NFT_SALES_QUERY, {
      since: timestamp,
      lastId,
      limit
    });

    return data.event;
  });

  return events.map(mapNftSold).filter(isDefined);
};
