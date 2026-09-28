import { beforeEach, describe, expect, it, vi } from 'vitest';

import { objktGraphql } from './client';
import { getAuctionBids } from './get-auction-bids';
import { getNftSales } from './get-nft-sales';
import { getOffersReceived } from './get-offers-received';
import {
  GET_AUCTION_BIDS_QUERY,
  GET_NFT_SALES_QUERY,
  GET_OFFERS_RECEIVED_QUERY,
  GET_TOKEN_HOLDERS_QUERY,
  GET_TOKEN_MOVEMENTS_QUERY
} from './queries';
import { getSameBlockMovementsAfterOffers } from './same-block-movements';
import { ObjktGraphqlEvent } from './types';

vi.mock('./same-block-movements', () => ({
  getSameBlockMovementsAfterOffers: vi.fn(async () => new Map())
}));

vi.mock('./client', () => ({
  fetchAllObjktPages: vi.fn(
    async (
      _since: Date | string,
      fetchPage: (params: { since: string; lastId: number; limit: number }) => Promise<unknown[]>
    ) => fetchPage({ since: '2020-01-01T00:00:00.000Z', lastId: 0, limit: 100 })
  ),
  objktGraphql: vi.fn()
}));

const graphql = vi.mocked(objktGraphql);
const sameBlockMovements = vi.mocked(getSameBlockMovementsAfterOffers);

const token = {
  token_id: '1',
  name: 'Tezzard',
  fa_contract: 'KT1abc'
};

const event = (overrides: Partial<ObjktGraphqlEvent> = {}): ObjktGraphqlEvent => ({
  id: 10,
  timestamp: '2020-01-01T00:00:00.000Z',
  price: 1_500_000,
  creator_address: 'tz1creator',
  recipient_address: 'tz1seller',
  token_pk: 99,
  currency: { symbol: 'tez', decimals: 6 },
  token,
  ...overrides
});

describe('objkt getters', () => {
  beforeEach(() => {
    graphql.mockReset();
    sameBlockMovements.mockReset();
    sameBlockMovements.mockResolvedValue(new Map());
  });

  it('maps offer holders at offer time, excluding later buyers, the creator, and incomplete events', async () => {
    graphql.mockImplementation(async query => {
      if (query === GET_OFFERS_RECEIVED_QUERY) {
        return {
          event: [
            event(),
            event({ id: 11, price: null }),
            event({
              id: 12,
              timestamp: '2020-01-01T00:00:00.000Z',
              token_pk: 99
            })
          ]
        };
      }

      if (query === GET_TOKEN_HOLDERS_QUERY) {
        return {
          token_holder: [
            { token_pk: 99, holder_address: 'tz1new', quantity: 1 },
            { token_pk: 99, holder_address: 'tz1creator', quantity: 1 },
            { token_pk: 99, holder_address: 'tz1extra', quantity: '1' }
          ]
        };
      }

      if (query === GET_TOKEN_MOVEMENTS_QUERY) {
        return {
          event: [
            event({
              id: 50,
              timestamp: '2020-01-01T01:00:00.000Z',
              amount: 1,
              event_type: 'transfer',
              creator_address: 'tz1old',
              recipient_address: 'tz1new',
              token_pk: 99,
              price: null,
              token: null
            })
          ]
        };
      }

      throw new Error(`unexpected query ${query}`);
    });

    await expect(getOffersReceived(new Date('2020-01-01T00:00:00.000Z'))).resolves.toEqual([
      {
        id: 10,
        timestamp: '2020-01-01T00:00:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        holderAddresses: ['tz1extra', 'tz1old']
      },
      {
        id: 12,
        timestamp: '2020-01-01T00:00:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        holderAddresses: ['tz1extra', 'tz1old']
      }
    ]);
    expect(GET_OFFERS_RECEIVED_QUERY).not.toContain('holders(');
    expect(graphql).toHaveBeenCalledWith(GET_OFFERS_RECEIVED_QUERY, {
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
    expect(graphql).toHaveBeenCalledWith(GET_TOKEN_HOLDERS_QUERY, {
      tokenPks: [99],
      limit: 100,
      offset: 0
    });
    expect(graphql).toHaveBeenCalledWith(GET_TOKEN_MOVEMENTS_QUERY, {
      tokenPks: [99],
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
    expect(sameBlockMovements).not.toHaveBeenCalled();
  });

  it('asks TzKT to order a transfer that shares the offer timestamp', async () => {
    graphql.mockImplementation(async query => {
      if (query === GET_OFFERS_RECEIVED_QUERY) {
        return {
          event: [event({ level: 15140977, ophash: 'ophash' })]
        };
      }

      if (query === GET_TOKEN_HOLDERS_QUERY) {
        return {
          token_holder: [{ token_pk: 99, holder_address: 'tz1new', quantity: 1 }]
        };
      }

      if (query === GET_TOKEN_MOVEMENTS_QUERY) {
        return {
          event: [
            event({
              id: 50,
              timestamp: '2020-01-01T00:00:00.000Z',
              amount: 1,
              event_type: 'transfer',
              creator_address: 'tz1old',
              recipient_address: 'tz1new',
              token_pk: 99,
              price: null,
              token: null
            })
          ]
        };
      }

      throw new Error(`unexpected query ${query}`);
    });
    sameBlockMovements.mockResolvedValue(
      new Map([
        [
          10,
          [
            {
              tokenPk: 99,
              timestamp: '2020-01-01T00:00:00.000Z',
              amount: 1,
              sender: 'tz1old',
              recipient: 'tz1new'
            }
          ]
        ]
      ])
    );

    const [offerReceived] = await getOffersReceived('2020-01-01T00:00:00.000Z');

    expect(offerReceived.holderAddresses).toEqual(['tz1old']);
    expect(sameBlockMovements).toHaveBeenCalledWith([
      {
        id: 10,
        level: 15140977,
        ophash: 'ophash',
        timestamp: '2020-01-01T00:00:00.000Z',
        tokenPk: 99,
        faContract: 'KT1abc',
        tokenId: '1'
      }
    ]);
  });

  it('maps auction bids from recipient_address', async () => {
    graphql.mockResolvedValue({
      event: [event(), event({ id: 11, recipient_address: null })]
    });

    await expect(getAuctionBids('2020-01-01T00:00:00.000Z')).resolves.toEqual([
      {
        id: 10,
        timestamp: '2020-01-01T00:00:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        sellerAddress: 'tz1seller'
      }
    ]);
    expect(graphql).toHaveBeenCalledWith(GET_AUCTION_BIDS_QUERY, {
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
  });

  it('maps nft sales from creator_address', async () => {
    graphql.mockResolvedValue({
      event: [event(), event({ id: 11, creator_address: null })]
    });

    await expect(getNftSales('2020-01-01T00:00:00.000Z')).resolves.toEqual([
      {
        id: 10,
        timestamp: '2020-01-01T00:00:00.000Z',
        token: { tokenId: '1', name: 'Tezzard', faContract: 'KT1abc' },
        amount: 1_500_000,
        currency: { symbol: 'tez', decimals: 6 },
        sellerAddress: 'tz1creator'
      }
    ]);
    expect(graphql).toHaveBeenCalledWith(GET_NFT_SALES_QUERY, {
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
  });
});
