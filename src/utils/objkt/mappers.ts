import { isDefined } from '../helpers';

import { ObjktCurrency, ObjktGraphqlCurrency, ObjktGraphqlEvent, ObjktGraphqlToken, ObjktToken } from './types';

export const mapObjktCurrency = (currency: ObjktGraphqlCurrency | null): ObjktCurrency | null => {
  if (!isDefined(currency)) {
    return null;
  }

  return {
    symbol: currency.symbol,
    decimals: currency.decimals
  };
};

export const mapObjktToken = (token: ObjktGraphqlToken): ObjktToken => ({
  tokenId: token.token_id,
  name: token.name,
  faContract: token.fa_contract
});

export const isCompleteObjktEvent = (
  event: ObjktGraphqlEvent
): event is ObjktGraphqlEvent & { price: number; token: ObjktGraphqlToken } =>
  isDefined(event.price) && isDefined(event.token);
