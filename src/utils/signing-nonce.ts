import { randomStringForEntropy } from '@stablelib/random';
import { validateAddress, ValidationResult } from '@taquito/utils';
import memoizee from 'memoizee';

import { CodedError } from './errors';

export const SIGNING_NONCE_TTL = 5 * 60_000;

const MEMOIZE_OPTIONS = {
  max: 500,
  maxAge: SIGNING_NONCE_TTL
};

export const getSigningNonce = memoizee((pkh: string) => {
  if (validateAddress(pkh) !== ValidationResult.VALID) throw new CodedError(400, 'Invalid address');

  return buildNonce();
}, MEMOIZE_OPTIONS);

function buildNonce() {
  // The way it is done in SIWE.generateNonce()
  return randomStringForEntropy(96);
}
