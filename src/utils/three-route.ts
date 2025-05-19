import { EnvVars } from '../config';

import { makeBuildQueryFn } from './makeBuildQueryFn';

interface SwapQueryParams {
  inputTokenSymbol: string;
  outputTokenSymbol: string;
  realAmount: string | number;
}

export enum ThreeRouteStandardEnum {
  xtz = 'xtz',
  fa12 = 'fa12',
  fa2 = 'fa2'
}

interface ThreeRouteTokenCommon {
  id: number;
  symbol: string;
  standard: ThreeRouteStandardEnum;
  contract: string | null;
  tokenId: string | null;
  decimals: number;
}

interface ThreeRouteTezosToken extends ThreeRouteTokenCommon {
  standard: ThreeRouteStandardEnum.xtz;
  contract: null;
  tokenId: null;
}

export interface ThreeRouteFa12Token extends ThreeRouteTokenCommon {
  standard: ThreeRouteStandardEnum.fa12;
  tokenId: null;
  contract: string;
}

export interface ThreeRouteFa2Token extends ThreeRouteTokenCommon {
  standard: ThreeRouteStandardEnum.fa2;
  tokenId: string;
  contract: string;
}

type ThreeRouteToken = ThreeRouteTezosToken | ThreeRouteFa12Token | ThreeRouteFa2Token;

type ThreeRouteExchangeRates = Record<string, { ask: number; bid: number }>;

type ThreeRouteQueryParams = object | SwapQueryParams;
type ThreeRouteQueryResponse = ThreeRouteExchangeRates | ThreeRouteToken[];

const threeRouteBuildQueryFn = makeBuildQueryFn<ThreeRouteQueryParams, ThreeRouteQueryResponse>(
  EnvVars.THREE_ROUTE_API_URL,
  5,
  { headers: { Authorization: `Basic ${EnvVars.THREE_ROUTE_API_AUTH_TOKEN}` } }
);

export const getThreeRouteTokens = threeRouteBuildQueryFn<object, ThreeRouteToken[]>('/tokens', []);

export const getThreeRouteExchangeRates = threeRouteBuildQueryFn<object, ThreeRouteExchangeRates>('/prices', []);
