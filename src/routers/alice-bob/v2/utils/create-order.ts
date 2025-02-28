import { AliceBobCreateOrderPayload, aliceBobOrder } from '../../interfaces';
import { aliceBobV2Api } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const createOrder = async (payload: AliceBobCreateOrderPayload) => {
  const { signature, now } = getSignature(payload);

  const response = await aliceBobV2Api.post<aliceBobOrder>('/create-order', payload, {
    headers: getRequestHeaders(signature, now)
  });

  return response.data;
};
