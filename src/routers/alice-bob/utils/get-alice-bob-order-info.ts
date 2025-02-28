import { aliceBobApi } from '../api';
import { aliceBobOrder } from '../interfaces';

import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const getAliceBobOrderInfo = async (orderId: string) => {
  const { signature, now } = getAliceBobSignature();

  const response = await aliceBobApi.get<aliceBobOrder>('/check-order', {
    headers: getAliceBobRequestHeaders(signature, now),
    params: { id: orderId }
  });

  return response.data;
};
