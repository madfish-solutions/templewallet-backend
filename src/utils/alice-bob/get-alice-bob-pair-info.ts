import crypto from 'crypto';
import {aliceBobApi} from "../api.sevice";

export const getAliceBobPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const now = Date.now();
  let initString = 'timestamp' + now;
  const signature = crypto.createHmac('SHA512', process.env.ALICE_BOB_PRIVATE_KEY!).update(initString).digest('hex');

  const response = await aliceBobApi.get<{ minamount: string, maxamount: string }>(
    '/get-pair-info/' + pair,
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return { minAmount: response.data.minamount, maxAmount: response.data.maxamount };
};
