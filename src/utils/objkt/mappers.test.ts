import { describe, expect, it } from 'vitest';

import { isCompleteObjktEvent, mapObjktCurrency, mapObjktToken } from './mappers';
import { ObjktGraphqlEvent } from './types';

describe('objkt mappers', () => {
  it('maps currency and token fields', () => {
    expect(mapObjktCurrency(null)).toBeNull();
    expect(mapObjktCurrency({ symbol: 'tez', decimals: 6 })).toEqual({ symbol: 'tez', decimals: 6 });
    expect(
      mapObjktToken({
        token_id: '1',
        name: 'Tezzard',
        fa_contract: 'KT1abc'
      })
    ).toEqual({
      tokenId: '1',
      name: 'Tezzard',
      faContract: 'KT1abc'
    });
  });

  it('requires both price and token for a complete event', () => {
    const event: ObjktGraphqlEvent = {
      id: 1,
      timestamp: '2020-01-01T00:00:00.000Z',
      price: null,
      currency: null,
      token: null
    };

    expect(isCompleteObjktEvent(event)).toBe(false);
    expect(isCompleteObjktEvent({ ...event, price: 1 })).toBe(false);
    expect(
      isCompleteObjktEvent({
        ...event,
        price: 1,
        token: { token_id: '1', name: null, fa_contract: 'KT1abc' }
      })
    ).toBe(true);
  });
});
