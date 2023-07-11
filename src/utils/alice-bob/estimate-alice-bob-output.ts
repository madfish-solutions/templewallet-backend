import { AliceBobEstimateAmountPayload } from '../../interfaces/alice-bob.interfaces';
import { aliceBobApi } from '../api.sevice';
import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const estimateAliceBobOutput = async (payload: AliceBobEstimateAmountPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  const response = await aliceBobApi.post<{ toAmount: number; fromRate: number; toRate: number }>(
    '/estimate-amount',
    payload,
    {
      headers: getAliceBobRequestHeaders(signature, now)
    }
  );

  return response.data.toAmount;
};
