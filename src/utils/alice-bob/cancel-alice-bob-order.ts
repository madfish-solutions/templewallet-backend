import {
  AliceBobCancelOrderPayload
} from '../../interfaces/alice-bob/alice-bob.interfaces';
import {aliceBobApi} from '../api.sevice';
import {getAliceBobRequestHeaders} from './get-alice-bob-request-headers';
import {getAliceBobSignature} from './get-alice-bob-signature';

export const cancelAliceBobOrder = async (payload: AliceBobCancelOrderPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  await aliceBobApi.post(
      '/cancel-order',
      payload,
      {
        headers: getAliceBobRequestHeaders(signature, now)
      });
};


