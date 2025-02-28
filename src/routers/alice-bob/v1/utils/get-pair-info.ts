import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const getPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const { signature, now } = getSignature();

  const { data } = await aliceBobApi.get<{ minamount: number; maxamount: number }>('/get-pair-info/' + pair, {
    headers: getRequestHeaders(signature, now)
  });

  return { minAmount: data.minamount, maxAmount: data.maxamount };
};
