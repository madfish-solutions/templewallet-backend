import { randomStringForEntropy } from '@stablelib/random';
import { getPkhfromPk, validateAddress, ValidationResult, verifySignature } from '@taquito/utils';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import memoizee from 'memoizee';
import * as yup from 'yup';

import { CodedError } from './utils/errors';

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

export async function tezosSigAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const sigHeaders = await sigAuthHeadersSchema.validate(req.headers).catch(() => null);

  if (!sigHeaders) return void res.status(StatusCodes.UNAUTHORIZED).send();

  const {
    'tw-sig-auth-tez-pk': publicKey,
    'tw-sig-auth-tez-msg': messageBytes,
    'tw-sig-auth-tez-sig': signature
  } = sigHeaders;

  let pkh: string;
  try {
    pkh = getPkhfromPk(publicKey);
  } catch (err) {
    console.error(err);

    return void res.status(StatusCodes.BAD_REQUEST).send({ message: 'Invalid public key' });
  }

  // Nonce
  const { value: nonce } = getSigningNonce(pkh);
  const nonceBytes = Buffer.from(nonce, 'utf-8').toString('hex');

  if (!messageBytes.includes(nonceBytes))
    return void res.status(StatusCodes.UNAUTHORIZED).send({ code: 'INVALID_NONCE', message: 'Invalid message nonce' });

  // Signature
  try {
    verifySignature(messageBytes, publicKey, signature);
  } catch (error) {
    console.error(error);

    return void res
      .status(StatusCodes.UNAUTHORIZED)
      .send({ code: 'INVALID_SIG', message: 'Invalid signature or message' });
  }

  removeSigningNonce(pkh);

  next();
}

const sigAuthHeadersSchema = yup.object().shape({
  'tw-sig-auth-tez-pk': yup.string().required(),
  'tw-sig-auth-tez-msg': yup.string().required(),
  'tw-sig-auth-tez-sig': yup.string().required()
});

function buildNonce() {
  // Same as in in SIWE.generateNonce()
  const value = randomStringForEntropy(96);

  const expiresAt = new Date(Date.now() + SIGNING_NONCE_TTL).toISOString();

  return { value, expiresAt };
}
