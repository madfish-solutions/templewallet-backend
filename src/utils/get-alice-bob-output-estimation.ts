import axios from 'axios';
import {AliceBobExchangeInfo, getAliceBobSignature} from "./get-signed-alice-bob-url";

export const getAliceBobOutputEstimation = async (isWithdraw: boolean, exchangeInfo: AliceBobExchangeInfo) => {
  const now = +new Date();
  const signature = getAliceBobSignature(exchangeInfo, now);

  const response = await axios.post<{ toAmount: number, fromRate: number, toRate: number }>(
    'https://api.abex.pro/api/v3/estimate-amount',
    exchangeInfo,
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return { outputAmount: response.data.toAmount, rate: isWithdraw ? response.data.toRate : response.data.fromRate };
};
