import { AliceBobEstimateAmountPayload } from '../../interfaces';
import { aliceBobV2Api } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const estimateOutput = async (payload: AliceBobEstimateAmountPayload) => {
  const { signature, now } = getSignature(payload);

  const response = await aliceBobV2Api.post<{ toAmount: number; fromRate: number; toRate: number }>(
    '/estimate-amount',
    payload,
    {
      headers: getRequestHeaders(signature, now)
    }
  );

  return response.data.toAmount;
};
