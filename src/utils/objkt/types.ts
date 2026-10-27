export interface ObjktCurrency {
  symbol: string | null;
  decimals: number | null;
}

export interface ObjktToken {
  tokenId: string;
  name: string | null;
  faContract: string;
}

export interface ObjktOfferReceived {
  id: number;
  timestamp: string;
  token: ObjktToken;
  amount: number;
  currency: ObjktCurrency | null;
  holderAddresses: string[];
}

export interface ObjktAuctionBid {
  id: number;
  timestamp: string;
  token: ObjktToken;
  amount: number;
  currency: ObjktCurrency | null;
  sellerAddress: string;
}

export interface ObjktNftSold {
  id: number;
  timestamp: string;
  token: ObjktToken;
  amount: number;
  currency: ObjktCurrency | null;
  sellerAddress: string;
}

export interface ObjktGraphqlCurrency {
  symbol: string | null;
  decimals: number | null;
}

export interface ObjktGraphqlTokenHolder {
  token_pk: number;
  holder_address: string;
  quantity: number | string;
}

export interface ObjktGraphqlToken {
  token_id: string;
  name: string | null;
  fa_contract: string;
}

export interface ObjktGraphqlEvent {
  id: number;
  timestamp: string;
  price: number | null;
  amount?: number | null;
  event_type?: string | null;
  level?: number | null;
  ophash?: string | null;
  creator_address?: string | null;
  recipient_address?: string | null;
  token_pk?: number | null;
  currency: ObjktGraphqlCurrency | null;
  token: ObjktGraphqlToken | null;
}

export interface ObjktTokenHolder {
  tokenPk: number;
  address: string;
  quantity: number;
}

/** A token balance change. Mints have no sender; burns have no recipient. */
export interface ObjktTokenMovement {
  tokenPk: number;
  timestamp: string;
  amount: number;
  sender?: string;
  recipient?: string;
}

export interface ObjktGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface ObjktPageParams {
  since: string;
  lastId: number;
  limit: number;
}
