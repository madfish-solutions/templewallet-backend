import { aliceBobApi } from '../api';
import { AliceBobCreateOrderPayload, aliceBobOrder } from '../interfaces';

import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const createAliceBobOrder = async (payload: AliceBobCreateOrderPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  const response = await aliceBobApi.post<aliceBobOrder>('/create-order', payload, {
    headers: getAliceBobRequestHeaders(signature, now)
  });

  return response.data;
};
