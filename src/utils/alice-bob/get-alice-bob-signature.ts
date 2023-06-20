import crypto from 'crypto';

import { ALICE_BOB_PRIVATE_KEY } from '../../config';
import { AliceBobPayload } from '../../interfaces/alice-bob.interfaces';

export const getAliceBobSignature = (payload?: AliceBobPayload) => {
  const now = Date.now();
  let initString = '';

  if (payload !== undefined) {
    const keys = Object.keys(payload).sort();
    let parametersSequence = ''; // needed only for check the initString generation sequence.

    for (let i = 0; i < keys.length; i++) {
      if (!Boolean(payload[keys[i]]) || typeof payload[keys[i]] === 'object') {
        continue;
      }
      initString += keys[i].toLowerCase() + payload[keys[i]].toString().toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      parametersSequence += keys[i] + ' | ';
    }
  }

  initString += 'timestamp' + now;

  return {
    signature: crypto.createHmac('SHA512', ALICE_BOB_PRIVATE_KEY).update(initString).digest('hex'),
    now
  };
};
