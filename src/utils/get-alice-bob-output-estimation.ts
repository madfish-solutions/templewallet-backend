import {AliceBobExchangeInfo, getAliceBobSignature} from "./get-signed-alice-bob-url";
import {aliceBobApi} from "./api.sevice";

export const getAliceBobOutputEstimation = async (isWithdraw: boolean, exchangeInfo: AliceBobExchangeInfo) => {
  const now = Date.now();
  const signature = getAliceBobSignature(exchangeInfo, now);

  const response = await aliceBobApi.post<{ toAmount: number, fromRate: number, toRate: number }>(
    '/estimate-amount',
    exchangeInfo,
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return { outputAmount: response.data.toAmount, exchangeRate: isWithdraw ? response.data.toRate : response.data.fromRate };
};
