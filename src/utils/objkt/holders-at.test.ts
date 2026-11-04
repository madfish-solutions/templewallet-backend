import { describe, expect, it } from 'vitest';

import { holdersAtOfferTime } from './holders-at';
import { ObjktTokenHolder, ObjktTokenMovement } from './types';

const holder = (address: string, quantity = 1, tokenPk = 99): ObjktTokenHolder => ({
  tokenPk,
  address,
  quantity
});

const movement = (overrides: Partial<ObjktTokenMovement>): ObjktTokenMovement => ({
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
        movements: []
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
        movements: [movement({ sender: 'tz1old', recipient: 'tz1new' })]
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
        movements: [movement({ amount: 1, sender: 'tz1alice', recipient: 'tz1bob' })]
      })
    ).toEqual(['tz1alice']);
  });

  it('leaves a same-timestamp transfer in place unless it is known to follow the offer', () => {
    const sameTimestamp = movement({
      timestamp: '2020-01-01T00:00:00.000Z',
      sender: 'tz1old',
      recipient: 'tz1new'
    });

    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1new')],
        movements: [sameTimestamp]
      })
    ).toEqual(['tz1new']);

    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1new')],
        movements: [sameTimestamp],
        sameBlockMovementsAfter: [sameTimestamp]
      })
    ).toEqual(['tz1old']);
  });

  it('removes tokens minted after the offer', () => {
    expect(
      holdersAtOfferTime({
        tokenPk: 99,
        at: '2020-01-01T00:00:00.000Z',
        creatorAddress: 'tz1buyer',
        currentHolders: [holder('tz1minter', 1), holder('tz1earlier', 2)],
        movements: [movement({ sender: undefined, recipient: 'tz1minter', amount: 1 })]
      })
    ).toEqual(['tz1earlier']);
  });
});
