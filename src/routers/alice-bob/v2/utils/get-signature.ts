import crypto from 'crypto';

import { EnvVars } from '../../../../config';
import { isDefined } from '../../../../utils/helpers';
import { AliceBobPayload } from '../../interfaces';

export const getSignature = (payload?: AliceBobPayload) => {
  const now = Date.now();
  let line = '';

  if (isDefined(payload)) {
    const sortedBody = Object.entries(payload).sort();

    for (const [key, value] of sortedBody) {
      if (isDefined(value)) {
        line += key.toLowerCase() + value.toString().toLowerCase();
      }
    }
  }

  line += 'timestamp' + now;

  const signer = crypto.createSign('RSA-SHA512');

  signer.update(Buffer.from(line));

  return {
    signature: signer.sign(EnvVars.ALICE_BOB_V2_PRIVATE_KEY, 'hex'),
    now
  };
};
