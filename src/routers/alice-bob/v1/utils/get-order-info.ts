import { aliceBobOrder } from '../../interfaces';
import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const getOrderInfo = async (orderId: string) => {
  const { signature, now } = getSignature();

  const response = await aliceBobApi.get<aliceBobOrder>('/check-order', {
    headers: getRequestHeaders(signature, now),
    params: { id: orderId }
  });

  return response.data;
};
