import axios, { AxiosRequestConfig, Method } from 'axios';

import { EnvVars } from '../../../config';

import { generateKoloRequestSignature } from './sign-request';

export const koloApi = axios.create({
  baseURL: EnvVars.KOLO_BASE_URL
});

export interface KoloRequestConfig<TRequest = any> {
  method: Method;
  path: string;
  query?: Record<string, any>;
  body?: TRequest;
}

export async function koloRequest<TResponse = any, TRequest = any>(
  config: KoloRequestConfig<TRequest>
): Promise<TResponse> {
  const { method, path, query, body } = config;

  const timestamp = Date.now();

  const queryString =
    query && Object.keys(query).length > 0
      ? new URLSearchParams(
          Object.entries(query).reduce<Record<string, string>>((acc, [k, v]) => {
            if (v === undefined || v === null) return acc;
            acc[k] = String(v);

            return acc;
          }, {})
        ).toString()
      : '';

  const bodyString = Boolean(body) ? JSON.stringify(body) : '';

  const signature = generateKoloRequestSignature({
    path,
    queryString,
    body: bodyString,
    timestamp
  });

  const url = queryString ? `${path}?${queryString}` : path;

  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    data: bodyString || undefined,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': EnvVars.KOLO_API_PUBLIC_KEY,
      'X-Signature': signature,
      'X-Timestamp': String(timestamp)
    }
  };

  const response = await koloApi.request<TResponse>(axiosConfig);

  return response.data;
}
