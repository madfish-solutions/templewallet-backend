export interface aliceBobOrder {
  id: string;
  status: string;
  from: string;
  to: string;
  payUrl: string;
  payCryptoAddress: string;
  payCryptoMemo: string;
  fromPaymentDetails: string;
  toPaymentDetails: string;
  toMemo: string;
  fromTxHash: string;
  toTxHash: string;
  fromAmount: number;
  fromAmountReceived: number;
  toAmount: number;
  fromRate: number;
  toRate: number;
  fromFee: number;
  toFee: number;
  side: 'SELL' | 'BUY';
  extraFromFee: number;
  extraToFee: number;
  redirectUrl: string;
  userId: string;
  partnerOrderId: string;
  fromRevenueShare: number;
  toRevenueShare: number;
  created: string;
  updated: string;
  orderExpirationTimetamp: number;
}

export interface AliceBobPairInfo {
  from: string;
  to: string;
  fromnetwork: string | null;
  tonetwork: string | null;
  in: string;
  out: string;
  ratetype: string;
  amount: string;
  tofee: string;
  fromfee: string;
  minamount: string;
  maxamount: string;
}

export interface AliceBobEstimateAmountPayload {
  from: string;
  to: string;
  fromAmount: number;
}

export interface AliceBobCreateOrderPayload extends AliceBobEstimateAmountPayload {
  toPaymentDetails: string;
  redirectUrl: string;
  userId: string;
}

export interface AliceBobCancelOrderPayload {
  id: string;
}

export type AliceBobPayload = AliceBobEstimateAmountPayload | AliceBobCreateOrderPayload | AliceBobCancelOrderPayload;
