import { AliceBobCancelOrderPayload } from '../../interfaces';
import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const cancelOrder = async (payload: AliceBobCancelOrderPayload) => {
  const { signature, now } = getSignature(payload);

  await aliceBobApi.post('/cancel-order', payload, {
    headers: getRequestHeaders(signature, now)
  });
};
