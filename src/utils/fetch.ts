import crossFetch from 'cross-fetch';

export class InvalidStatusError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export class NotOkFetchError extends Error {}

export default async function fetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await crossFetch(url, init);

  const body = await res.json();
  if (res.status >= 400) {
    throw new InvalidStatusError(body.message, res.status);
  }
  if (!res.ok) {
    throw new NotOkFetchError('An error occurred while fetching');
  }

  return body;
}
