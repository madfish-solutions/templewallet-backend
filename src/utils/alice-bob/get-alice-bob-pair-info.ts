import { aliceBobApi } from '../api.sevice';
import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const getAliceBobPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const { signature, now } = getAliceBobSignature();

  const { data } = await aliceBobApi.get<{ minamount: number; maxamount: number }>('/get-pair-info/' + pair, {
    headers: getAliceBobRequestHeaders(signature, now)
  });

  return { minAmount: data.minamount, maxAmount: data.maxamount };
};
