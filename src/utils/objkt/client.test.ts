import axios, { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAllObjktPages, objktGraphql } from './client';

vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('fetchAllObjktPages', () => {
  it('paginates by last id until a short page', async () => {
    const fetchPage = vi.fn(async ({ lastId, limit }: { lastId: number; limit: number }) => {
      if (lastId === 0) {
        return Array.from({ length: limit }, (_, index) => ({ id: index + 1 }));
      }

      return [{ id: limit + 1 }];
    });

    await expect(fetchAllObjktPages('2020-01-01T00:00:00.000Z', fetchPage)).resolves.toEqual(
      Array.from({ length: 101 }, (_, index) => ({ id: index + 1 }))
    );
    expect(fetchPage).toHaveBeenCalledWith({
      since: '2020-01-01T00:00:00.000Z',
      lastId: 0,
      limit: 100
    });
    expect(fetchPage).toHaveBeenCalledWith({
      since: '2020-01-01T00:00:00.000Z',
      lastId: 100,
      limit: 100
    });
  });

  it('shrinks the page size after a timeout and keeps the smaller limit', async () => {
    const fetchPage = vi.fn(async ({ lastId, limit }: { lastId: number; limit: number }) => {
      if (limit === 100) {
        throw new Error('timeout');
      }

      if (lastId === 0) {
        return Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
      }

      return [{ id: 51 }];
    });

    await expect(fetchAllObjktPages('2020-01-01T00:00:00.000Z', fetchPage)).resolves.toEqual(
      Array.from({ length: 50 }, (_, index) => ({ id: index + 1 })).concat({ id: 51 })
    );
    expect(fetchPage.mock.calls.map(call => call[0].limit)).toEqual([100, 50, 50]);
  });

  it('rejects an invalid since date', async () => {
    await expect(fetchAllObjktPages('not-a-date', async () => [])).rejects.toThrow('Invalid Objkt since date');
  });

  it('retries at the minimum page size after a timeout and then returns the page', async () => {
    vi.useFakeTimers();
    const fetchPage = vi.fn(async ({ limit }: { limit: number }) => {
      const minLimitCalls = fetchPage.mock.calls.filter(call => call[0].limit === 10).length;
      if (limit > 10 || minLimitCalls === 1) {
        throw new Error('timeout');
      }

      return [{ id: 1 }];
    });

    try {
      const pending = fetchAllObjktPages('2020-01-01T00:00:00.000Z', fetchPage);
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual([{ id: 1 }]);
      expect(fetchPage.mock.calls.map(call => call[0].limit)).toEqual([100, 50, 25, 12, 10, 10]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('objktGraphql', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns GraphQL data and throws payload errors', async () => {
    const post = vi.spyOn(axios, 'post');
    post.mockResolvedValueOnce({ data: { data: { ok: true } } });

    await expect(objktGraphql('query Q', { since: 'x' })).resolves.toEqual({ ok: true });

    post.mockResolvedValueOnce({ data: { errors: [{ message: 'boom' }] } });

    await expect(objktGraphql('query Q', {})).rejects.toThrow('boom');

    post.mockResolvedValueOnce({ data: {} });

    await expect(objktGraphql('query Q', {})).rejects.toThrow('Objkt GraphQL response is missing data');
  });

  it('retries a 429 and then returns data', async () => {
    vi.useFakeTimers();
    const post = vi.spyOn(axios, 'post');
    const tooManyRequests = new AxiosError('fail');
    tooManyRequests.response = {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      data: {},
      config: {} as never
    };
    post.mockRejectedValueOnce(tooManyRequests);
    post.mockResolvedValueOnce({ data: { data: { ok: true } } });

    try {
      const pending = objktGraphql('query Q', {});
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual({ ok: true });
      expect(post).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
