import { aliceBobApi } from '../api';
import { AliceBobCancelOrderPayload } from '../interfaces';

import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const cancelAliceBobOrder = async (payload: AliceBobCancelOrderPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  await aliceBobApi.post('/cancel-order', payload, {
    headers: getAliceBobRequestHeaders(signature, now)
  });
};
