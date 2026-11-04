import { objktGraphql } from './client';
import { GET_TOKEN_HOLDERS_QUERY } from './queries';
import { ObjktGraphqlTokenHolder, ObjktTokenHolder } from './types';

const HOLDERS_PAGE_SIZE = 100;

interface TokenHoldersResponse {
  token_holder: ObjktGraphqlTokenHolder[];
}

const toQuantity = (quantity: number | string) => {
  const parsed = typeof quantity === 'number' ? quantity : Number(quantity);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const getTokenHolders = async (tokenPks: number[]): Promise<ObjktTokenHolder[]> => {
  if (tokenPks.length === 0) {
    return [];
  }

  const holders: ObjktTokenHolder[] = [];
  let offset = 0;

  while (true) {
    const data = await objktGraphql<TokenHoldersResponse>(GET_TOKEN_HOLDERS_QUERY, {
      tokenPks,
      limit: HOLDERS_PAGE_SIZE,
      offset
    });
    const page = data.token_holder;

    holders.push(
      ...page.map(holder => ({
        tokenPk: holder.token_pk,
        address: holder.holder_address,
        quantity: toQuantity(holder.quantity)
      }))
    );

    if (page.length < HOLDERS_PAGE_SIZE) {
      return holders;
    }

    offset += HOLDERS_PAGE_SIZE;
  }
};
