import { beforeEach, describe, expect, it, vi } from 'vitest';

import { objktGraphql } from './client';
import { getTokenTransfers } from './get-token-transfers';
import { GET_TOKEN_TRANSFERS_QUERY } from './queries';
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

const transferEvent = (overrides: Partial<ObjktGraphqlEvent> = {}): ObjktGraphqlEvent => ({
  id: 50,
  timestamp: '2020-01-01T01:00:00.000Z',
  price: null,
  amount: 1,
  creator_address: 'tz1old',
  recipient_address: 'tz1new',
  token_pk: 99,
  currency: null,
  token: null,
  ...overrides
});

describe('getTokenTransfers', () => {
  beforeEach(() => {
    graphql.mockReset();
  });

  it('returns an empty list without querying when no token pks are given', async () => {
    await expect(getTokenTransfers([], '2020-01-01T00:00:00.000Z')).resolves.toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('maps complete transfers and skips incomplete events', async () => {
    graphql.mockResolvedValue({
      event: [
        transferEvent(),
        transferEvent({ id: 51, amount: 0 }),
        transferEvent({ id: 52, creator_address: null }),
        transferEvent({ id: 53, recipient_address: '' }),
        transferEvent({ id: 54, token_pk: null })
      ]
    });

    await expect(getTokenTransfers([99], '2020-01-01T00:00:00.000Z')).resolves.toEqual([
      {
        id: 50,
        tokenPk: 99,
        timestamp: '2020-01-01T01:00:00.000Z',
        amount: 1,
        sender: 'tz1old',
        recipient: 'tz1new'
      }
    ]);
    expect(graphql).toHaveBeenCalledWith(GET_TOKEN_TRANSFERS_QUERY, {
      tokenPks: [99],
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
  });
});
