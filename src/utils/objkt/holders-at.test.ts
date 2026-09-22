import { describe, expect, it } from 'vitest';

import { holdersAtOfferTime } from './holders-at';
import { ObjktTokenHolder, ObjktTokenTransfer } from './types';

const holder = (address: string, quantity = 1, tokenPk = 99): ObjktTokenHolder => ({
  tokenPk,
  address,
  quantity
});

const transfer = (overrides: Partial<ObjktTokenTransfer>): ObjktTokenTransfer => ({
  id: 1,
  tokenPk: 99,
  timestamp: '2020-01-01T01:00:00.000Z',
  amount: 1,
  sender: 'tz1old',
  recipient: 'tz1new',
  ...overrides
});

describe('holdersAtOfferTime', () => {
  it('notifies current holders except the offer creator when nothing moved later', () => {
    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1holder'), holder('tz1buyer'), holder('tz1other-token', 1, 100)],
        transfers: []
      })
    ).toEqual(['tz1holder']);
  });

  it('excludes a buyer after the offer and restores the previous holder', () => {
    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1new')],
        transfers: [transfer({ id: 8, sender: 'tz1old', recipient: 'tz1new' })]
      })
    ).toEqual(['tz1old']);
  });

  it('keeps a holder who still owns editions after a later partial transfer', () => {
    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1alice', 4), holder('tz1bob', 1)],
        transfers: [transfer({ id: 8, amount: 1, sender: 'tz1alice', recipient: 'tz1bob' })]
      })
    ).toEqual(['tz1alice']);
  });
});
