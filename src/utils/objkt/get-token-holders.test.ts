import { beforeEach, describe, expect, it, vi } from 'vitest';

import { objktGraphql } from './client';
import { getTokenHolders } from './get-token-holders';
import { GET_TOKEN_HOLDERS_QUERY } from './queries';

vi.mock('./client', () => ({
  objktGraphql: vi.fn()
}));

const graphql = vi.mocked(objktGraphql);

describe('getTokenHolders', () => {
  beforeEach(() => {
    graphql.mockReset();
  });

  it('returns an empty list without querying when no token pks are given', async () => {
    await expect(getTokenHolders([])).resolves.toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('paginates holders and coerces quantities', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      token_pk: 99,
      holder_address: `holder-${index}`,
      quantity: 1
    }));
    graphql.mockResolvedValueOnce({ token_holder: firstPage });
    graphql.mockResolvedValueOnce({
      token_holder: [{ token_pk: 99, holder_address: 'holder-last', quantity: '2' }]
    });

    await expect(getTokenHolders([99])).resolves.toEqual([
      ...firstPage.map(holder => ({ tokenPk: 99, address: holder.holder_address, quantity: 1 })),
      { tokenPk: 99, address: 'holder-last', quantity: 2 }
    ]);
    expect(graphql).toHaveBeenNthCalledWith(1, GET_TOKEN_HOLDERS_QUERY, {
      tokenPks: [99],
      limit: 100,
      offset: 0
    });
    expect(graphql).toHaveBeenNthCalledWith(2, GET_TOKEN_HOLDERS_QUERY, {
      tokenPks: [99],
      limit: 100,
      offset: 100
    });
  });
});
