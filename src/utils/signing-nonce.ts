import { randomStringForEntropy } from '@stablelib/random';
import { validateAddress, ValidationResult } from '@taquito/utils';
import memoizee from 'memoizee';

import { CodedError } from './errors';

const SIGNING_NONCE_TTL = 5 * 60_000;

export const getSigningNonce = memoizee(
  (pkh: string) => {
    if (validateAddress(pkh) !== ValidationResult.VALID) throw new CodedError(400, 'Invalid address');

    return buildNonce();
  },
  {
    max: 1_000_000,
    maxAge: SIGNING_NONCE_TTL
  }
);

export function removeSigningNonce(pkh: string) {
  getSigningNonce.delete(pkh);
}

function buildNonce() {
  // Same as in in SIWE.generateNonce()
  const value = randomStringForEntropy(96);

  const expiresAt = new Date(Date.now() + SIGNING_NONCE_TTL).toISOString();

  return { value, expiresAt };
}
