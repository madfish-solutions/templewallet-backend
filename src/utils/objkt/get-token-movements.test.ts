import { beforeEach, describe, expect, it, vi } from 'vitest';

import { objktGraphql } from './client';
import { getTokenMovements } from './get-token-movements';
import { GET_TOKEN_MOVEMENTS_QUERY } from './queries';
import { ObjktGraphqlEvent } from './types';

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

const movementEvent = (overrides: Partial<ObjktGraphqlEvent> = {}): ObjktGraphqlEvent => ({
  id: 50,
  timestamp: '2020-01-01T01:00:00.000Z',
  price: null,
  amount: 1,
  event_type: 'transfer',
  creator_address: 'tz1old',
  recipient_address: 'tz1new',
  token_pk: 99,
  currency: null,
  token: null,
  ...overrides
});

describe('getTokenMovements', () => {
  beforeEach(() => {
    graphql.mockReset();
  });

  it('returns an empty list without querying when no token pks are given', async () => {
    await expect(getTokenMovements([], '2020-01-01T00:00:00.000Z')).resolves.toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('maps transfers and mints and skips incomplete events', async () => {
    graphql.mockResolvedValue({
      event: [
        movementEvent(),
        movementEvent({
          id: 51,
          event_type: 'mint',
          amount: 2,
          creator_address: 'tz1minter',
          recipient_address: null
        }),
        movementEvent({ id: 52, amount: 0 }),
        movementEvent({ id: 53, creator_address: null }),
        movementEvent({ id: 54, event_type: 'mint', creator_address: null, recipient_address: null }),
        movementEvent({ id: 55, token_pk: null })
      ]
    });

    await expect(getTokenMovements([99], '2020-01-01T00:00:00.000Z')).resolves.toEqual([
      {
        tokenPk: 99,
        timestamp: '2020-01-01T01:00:00.000Z',
        amount: 1,
        sender: 'tz1old',
        recipient: 'tz1new'
      },
      {
        tokenPk: 99,
        timestamp: '2020-01-01T01:00:00.000Z',
        amount: 2,
        recipient: 'tz1minter'
      }
    ]);
    expect(graphql).toHaveBeenCalledWith(GET_TOKEN_MOVEMENTS_QUERY, {
      tokenPks: [99],
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
  });
});
