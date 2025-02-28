import { AliceBobEstimateAmountPayload } from '../../interfaces';
import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const estimateOutput = async (payload: AliceBobEstimateAmountPayload) => {
  const { signature, now } = getSignature(payload);

  const response = await aliceBobApi.post<{ toAmount: number; fromRate: number; toRate: number }>(
    '/estimate-amount',
    payload,
    {
      headers: getRequestHeaders(signature, now)
    }
  );

  return response.data.toAmount;
};
