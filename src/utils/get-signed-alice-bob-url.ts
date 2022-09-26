import crypto from 'crypto';
import {aliceBobApi} from "./api.sevice";

export interface AliceBobExchangeInfo {
  from: string;
  to: string;
  fromAmount: number;
  userId?: string;
  toPaymentDetails?: string;
}

export const getSignedAliceBobUrl = async (exchangeInfo: AliceBobExchangeInfo) => {
  const now = Date.now();
  const signature = getAliceBobSignature(exchangeInfo, now);

  const response = await aliceBobApi.post<{ payUrl: string }>(
    '/create-order',
    exchangeInfo,
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return response.data.payUrl;
};

export const getAliceBobSignature = (exchangeInfo: AliceBobExchangeInfo, now: number) => {
  const keys = Object.keys(exchangeInfo).sort();
  let initString = '';
  let parametersSequence = ''; // needed only for check the initString generation sequence.

  for (let i = 0; i < keys.length; i++) {
    if (!exchangeInfo[keys[i]] || typeof exchangeInfo[keys[i]] === 'object') {
      continue;
    }
    initString += keys[i].toLowerCase() + exchangeInfo[keys[i]].toString().toLowerCase();
    parametersSequence += keys[i] + ' | ';
  }

  initString += 'timestamp' + now;

  return crypto.createHmac('SHA512', process.env.ALICE_BOB_PRIVATE_KEY!).update(initString).digest('hex');
}
