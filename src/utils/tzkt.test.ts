import axios, { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTzktTokenBalances } from './tzkt';

vi.mock('./logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

const axiosError = (status?: number) => {
  const error = new AxiosError('fail');
  if (status !== undefined) {
    error.response = {
      status,
      statusText: 'error',
      headers: {},
      data: {},
      config: {} as never
    };
  }

  return error;
};

describe('TzKT queries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('retries a transient failure and then returns the response', async () => {
    vi.useFakeTimers();
    const request = vi.spyOn(axios, 'request');
    request.mockRejectedValueOnce(axiosError(503));
    request.mockResolvedValueOnce({ data: [{ balance: '1' }] });

    try {
      const pending = getTzktTokenBalances({ account: 'tz1', contract: 'KT1' });
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual([{ balance: '1' }]);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a network failure that has no response', async () => {
    vi.useFakeTimers();
    const request = vi.spyOn(axios, 'request');
    request.mockRejectedValueOnce(axiosError());
    request.mockResolvedValueOnce({ data: [{ balance: '2' }] });

    try {
      const pending = getTzktTokenBalances({ account: 'tz1', contract: 'KT1' });
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual([{ balance: '2' }]);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a client error', async () => {
    const request = vi.spyOn(axios, 'request');
    const error = axiosError(400);
    request.mockRejectedValue(error);

    await expect(getTzktTokenBalances({ account: 'tz1', contract: 'KT1' })).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps at most four TzKT requests in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.spyOn(axios, 'request').mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 30));
      inFlight -= 1;

      return { data: [] };
    });

    await Promise.all(Array.from({ length: 8 }, () => getTzktTokenBalances({ account: 'tz1', contract: 'KT1' })));

    expect(maxInFlight).toBe(4);
  });
});
