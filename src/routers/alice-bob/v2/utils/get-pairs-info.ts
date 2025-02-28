import { AliceBobPairInfo } from '../../interfaces';
import { aliceBobV2Api } from '../api';

import { getRequestHeaders } from './get-request-headers';
import { getSignature } from './get-signature';

export const getPairsInfo = async () => {
  const { signature, now } = getSignature();

  const { data } = await aliceBobV2Api.get<AliceBobPairInfo[]>('/get-pairs-info', {
    headers: getRequestHeaders(signature, now)
  });

  return data;
};
