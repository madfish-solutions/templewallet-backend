import { aliceBobApi } from '../api';
import { AliceBobPairInfo } from '../interfaces';

import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const getAliceBobPairsInfo = async (isWithdraw = false) => {
  const { signature, now } = getAliceBobSignature();

  const { data } = await aliceBobApi.get<AliceBobPairInfo[]>('/get-pairs-info', {
    headers: getAliceBobRequestHeaders(signature, now)
  });

  return data.filter(pair => (isWithdraw ? pair.from === 'TEZ' : pair.from !== 'TEZ'));
};
