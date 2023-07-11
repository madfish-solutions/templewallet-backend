import { THREE_ROUTE_API_AUTH_TOKEN, THREE_ROUTE_API_URL } from '../config';
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

export interface ThreeRouteHop {
  dex: number;
  forward: boolean;
}

export interface ThreeRouteChain {
  input: number;
  output: number;
  hops: ThreeRouteHop[];
}

// TODO: add axios adapter and change type if precision greater than of standard js number type is necessary
export interface ThreeRouteSwapResponse {
  input: number;
  output: number;
  chains: ThreeRouteChain[];
}

export interface ThreeRouteSirsSwapResponse {
  input: number;
  output: number;
  tzbtcChain: ThreeRouteSwapResponse;
  xtzChain: ThreeRouteSwapResponse;
}

interface ThreeRouteTokenCommon {
  id: number;
  symbol: string;
  standard: ThreeRouteStandardEnum;
  contract: string | null;
  tokenId: string | null;
  decimals: number;
}

export interface ThreeRouteTezosToken extends ThreeRouteTokenCommon {
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

export type ThreeRouteToken = ThreeRouteTezosToken | ThreeRouteFa12Token | ThreeRouteFa2Token;

export enum ThreeRouteDexTypeEnum {
  PlentyTokenToToken = 'PlentyTokenToToken',
  PlentyTokenToTokenStable = 'PlentyTokenToTokenStable',
  PlentyTokenToTokenVolatile = 'PlentyTokenToTokenVolatile',
  PlentyCtezStable = 'PlentyCtezStable',
  QuipuSwapTokenToTokenStable = 'QuipuSwapTokenToTokenStable',
  QuipuSwapTezToTokenFa12 = 'QuipuSwapTezToTokenFa12',
  QuipuSwapTezToTokenFa2 = 'QuipuSwapTezToTokenFa2',
  QuipuSwapTokenToToken = 'QuipuSwapTokenToToken',
  QuipuSwapDex2 = 'QuipuSwapDex2',
  DexterLb = 'DexterLb',
  FlatYouvesStable = 'FlatYouvesStable',
  VortexTokenToTokenFa12 = 'VortexTokenToTokenFa12',
  VortexTokenToTokenFa2 = 'VortexTokenToTokenFa2',
  SpicyTokenToToken = 'SpicyTokenToToken',
  WTZSwap = 'WTZSwap',
  CtezToXtz = 'CtezToXtz',
  PlentyWrappedTokenBridgeSwap = 'PlentyWrappedTokenBridgeSwap',
  FlatYouvesStableUXTZ = 'FlatYouvesStableUXTZ'
}

export interface ThreeRouteDex {
  id: number;
  type: ThreeRouteDexTypeEnum;
  contract: string;
  token1: ThreeRouteToken;
  token2: ThreeRouteToken;
}

type ThreeRouteQueryParams = object | SwapQueryParams;
type ThreeRouteQueryResponse =
  | ThreeRouteSwapResponse
  | ThreeRouteSirsSwapResponse
  | ThreeRouteDex[]
  | ThreeRouteToken[];

export const THREE_ROUTE_SIRS_SYMBOL = 'SIRS';

const threeRouteBuildQueryFn = makeBuildQueryFn<ThreeRouteQueryParams, ThreeRouteQueryResponse>(
  THREE_ROUTE_API_URL,
  5,
  { headers: { Authorization: `Basic ${THREE_ROUTE_API_AUTH_TOKEN}` } }
);

export const getThreeRouteSwap = threeRouteBuildQueryFn<
  SwapQueryParams,
  ThreeRouteSwapResponse | ThreeRouteSirsSwapResponse
>(({ inputTokenSymbol, outputTokenSymbol, realAmount }) => {
  const isSirsSwap = inputTokenSymbol === THREE_ROUTE_SIRS_SYMBOL || outputTokenSymbol === THREE_ROUTE_SIRS_SYMBOL;

  return `/${isSirsSwap ? 'swap-sirs' : 'swap'}/${inputTokenSymbol}/${outputTokenSymbol}/${realAmount}`;
});

export const getThreeRouteDexes = threeRouteBuildQueryFn<object, ThreeRouteDex[]>('/dexes', []);

export const getThreeRouteTokens = threeRouteBuildQueryFn<object, ThreeRouteToken[]>('/tokens', []);

export const getChains = (response: ThreeRouteSwapResponse | ThreeRouteSirsSwapResponse) =>
  'chains' in response ? response.chains : [...response.xtzChain.chains, ...response.tzbtcChain.chains];
