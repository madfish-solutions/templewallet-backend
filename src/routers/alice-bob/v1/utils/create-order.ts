import { AliceBobCreateOrderPayload, aliceBobOrder } from '../../interfaces';
import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const createOrder = async (payload: AliceBobCreateOrderPayload) => {
  const { signature, now } = getSignature(payload);

  const response = await aliceBobApi.post<aliceBobOrder>('/create-order', payload, {
    headers: getRequestHeaders(signature, now)
  });

  return response.data;
};
