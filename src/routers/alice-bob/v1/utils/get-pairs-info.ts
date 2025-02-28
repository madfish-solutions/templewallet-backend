import { AliceBobPairInfo } from '../../interfaces';
import { aliceBobApi } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const getPairsInfo = async (isWithdraw = false) => {
  const { signature, now } = getSignature();

  const { data } = await aliceBobApi.get<AliceBobPairInfo[]>('/get-pairs-info', {
    headers: getRequestHeaders(signature, now)
  });

  return data.filter(pair => (isWithdraw ? pair.from === 'TEZ' : pair.to === 'TEZ'));
};
