import axios from 'axios';
import crypto from 'crypto';

export interface AliceBobExchangeInfo {
  from: string;
  to: string;
  fromAmount: number;
  userId: string;
  toPaymentDetails: string;
}

export const getSignedAliceBobUrl = async (exchangeInfo: AliceBobExchangeInfo) => {
  const now = +new Date();
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

  const signature = crypto.createHmac('SHA512', process.env.ALICE_BOB_PRIVATE_KEY!).update(initString).digest('hex');

  const response = await axios.post<{ payUrl: string }>(
    'https://exchange.alice-bob.io/api/v3/create-order',
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
