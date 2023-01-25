import { aliceBobOrder } from '../../interfaces/alice-bob/alice-bob.interfaces';
import { aliceBobApi } from '../api.sevice';
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
