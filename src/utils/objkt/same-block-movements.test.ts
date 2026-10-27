import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findOfferTransactionId,
  getSameBlockMovementsAfterOffers,
  movementsAfterTransaction,
  SameBlockOffer
} from './same-block-movements';

vi.mock('axios', () => ({
  default: {
    request: vi.fn()
  }
}));

const offer = (overrides: Partial<SameBlockOffer> = {}): SameBlockOffer => ({
  id: 10,
  level: 15140977,
  ophash: 'ophash',
  timestamp: '2020-01-01T00:00:00.000Z',
  tokenPk: 99,
  faContract: 'KT1abc',
  tokenId: '7',
  ...overrides
});

describe('findOfferTransactionId', () => {
  it('picks the offer call for the token when a batch contains several', () => {
    expect(
      findOfferTransactionId(
        [
          {
            id: 1,
            parameter: { entrypoint: 'offer', value: { token: { address: 'KT1other', token_id: '1' } } }
          },
          {
            id: 2,
            parameter: { entrypoint: 'offer', value: { token: { address: 'KT1abc', token_id: 7 } } }
          }
        ],
        'KT1abc',
        '7'
      )
    ).toBe(2);
  });

  it('uses the only offer call when its parameter does not name the token', () => {
    expect(findOfferTransactionId([{ id: 5, parameter: { entrypoint: 'offer', value: {} } }], 'KT1abc', '7')).toBe(5);
  });

  it('returns undefined when several offer calls cannot be matched to the token', () => {
    expect(
      findOfferTransactionId(
        [
          { id: 1, parameter: { entrypoint: 'offer', value: {} } },
          { id: 2, parameter: { entrypoint: 'offer', value: {} } }
        ],
        'KT1abc',
        '7'
      )
    ).toBeUndefined();
  });
});

describe('movementsAfterTransaction', () => {
  it('keeps transfers and mints that executed after the offer', () => {
    expect(
      movementsAfterTransaction(99, 100, [
        {
          transactionId: 90,
          timestamp: '2020-01-01T00:00:00Z',
          amount: '1',
          from: { address: 'tz1before' },
          to: { address: 'tz1mid' }
        },
        {
          transactionId: 100,
          timestamp: '2020-01-01T00:00:00Z',
          amount: '1',
          from: { address: 'tz1offer' },
          to: { address: 'tz1ignored' }
        },
        {
          transactionId: 110,
          timestamp: '2020-01-01T00:00:00Z',
          amount: '1',
          from: { address: 'tz1old' },
          to: { address: 'tz1new' }
        },
        {
          transactionId: 120,
          timestamp: '2020-01-01T00:00:00Z',
          amount: '3',
          to: { address: 'tz1minter' }
        }
      ])
    ).toEqual([
      {
        tokenPk: 99,
        timestamp: '2020-01-01T00:00:00Z',
        amount: 1,
        sender: 'tz1old',
        recipient: 'tz1new'
      },
      {
        tokenPk: 99,
        timestamp: '2020-01-01T00:00:00Z',
        amount: 3,
        sender: undefined,
        recipient: 'tz1minter'
      }
    ]);
  });
});

const requestUrl = (config: unknown) =>
  typeof config === 'object' && config !== null && 'url' in config ? String(config.url) : '';

describe('getSameBlockMovementsAfterOffers', () => {
  beforeEach(() => {
    vi.mocked(axios.request).mockReset();
  });

  it('loads each operation and token once and applies that order per offer', async () => {
    vi.mocked(axios.request).mockImplementation(async config => {
      if (requestUrl(config).includes('/operations/transactions/')) {
        return {
          data: [
            {
              id: 100,
              parameter: { entrypoint: 'offer', value: { token: { address: 'KT1abc', token_id: '7' } } }
            }
          ]
        };
      }

      return {
        data: [
          {
            transactionId: 90,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '1',
            from: { address: 'tz1before' },
            to: { address: 'tz1mid' }
          },
          {
            transactionId: 130,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '1',
            to: { address: 'tz1minter' }
          }
        ]
      };
    });

    const first = offer({ id: 10, ophash: 'opShared' });
    const second = offer({ id: 11, ophash: 'opShared' });

    await expect(getSameBlockMovementsAfterOffers([first, second])).resolves.toEqual(
      new Map([
        [
          10,
          [
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 1,
              sender: undefined,
              recipient: 'tz1minter'
            }
          ]
        ],
        [
          11,
          [
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 1,
              sender: undefined,
              recipient: 'tz1minter'
            }
          ]
        ]
      ])
    );
    expect(axios.request).toHaveBeenCalledTimes(2);
  });

  it('returns only movements that executed after each offer', async () => {
    vi.mocked(axios.request).mockImplementation(async config => {
      const url = requestUrl(config);
      if (url.includes('/operations/transactions/opEarly')) {
        return {
          data: [
            {
              id: 100,
              parameter: { entrypoint: 'offer', value: { token: { address: 'KT1abc', token_id: '7' } } }
            }
          ]
        };
      }
      if (url.includes('/operations/transactions/opLate')) {
        return {
          data: [
            {
              id: 120,
              parameter: { entrypoint: 'offer', value: { token: { address: 'KT1abc', token_id: '7' } } }
            }
          ]
        };
      }

      return {
        data: [
          {
            transactionId: 90,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '1',
            from: { address: 'tz1before' },
            to: { address: 'tz1mid' }
          },
          {
            transactionId: 110,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '2',
            from: { address: 'tz1betweenFrom' },
            to: { address: 'tz1betweenTo' }
          },
          {
            transactionId: 120,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '1',
            from: { address: 'tz1offer' },
            to: { address: 'tz1ignored' }
          },
          {
            transactionId: 130,
            timestamp: '2020-01-01T00:00:00Z',
            amount: '3',
            to: { address: 'tz1minter' }
          }
        ]
      };
    });

    const early = offer({ id: 10, ophash: 'opEarly' });
    const late = offer({ id: 11, ophash: 'opLate' });

    await expect(getSameBlockMovementsAfterOffers([early, late])).resolves.toEqual(
      new Map([
        [
          10,
          [
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 2,
              sender: 'tz1betweenFrom',
              recipient: 'tz1betweenTo'
            },
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 1,
              sender: 'tz1offer',
              recipient: 'tz1ignored'
            },
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 3,
              sender: undefined,
              recipient: 'tz1minter'
            }
          ]
        ],
        [
          11,
          [
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00Z',
              amount: 3,
              sender: undefined,
              recipient: 'tz1minter'
            }
          ]
        ]
      ])
    );
  });

  it('returns an empty map without calling TzKT when no offers share a block movement', async () => {
    await expect(getSameBlockMovementsAfterOffers([])).resolves.toEqual(new Map());
    expect(axios.request).not.toHaveBeenCalled();
  });
});
