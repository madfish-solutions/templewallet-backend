import * as ethersAddressUtils from '@ethersproject/address';
import * as ethersHashUtils from '@ethersproject/hash';
import * as ethersStringsUtils from '@ethersproject/strings';
import * as ethersTxUtils from '@ethersproject/transactions';
import { validateAddress, ValidationResult, verifySignature, getPkhfromPk } from '@taquito/utils';
import { StatusCodes } from 'http-status-codes';

import { redisClient } from './redis';
import { CodedError } from './utils/errors';
import { safeCheck } from './utils/helpers';
import { getSigningNonce, removeSigningNonce } from './utils/signing-nonce';

const REDIS_DB_KEY = 'magic_square_quest';

export function getMagicSquareQuestParticipants() {
  return redisClient.lrange(REDIS_DB_KEY, 0, -1).then(records => records.map(r => JSON.parse(r)));
}

interface StartQuestPayload {
  pkh: string;
  publicKey: string;
  messageBytes: string;
  signature: string;
  evm: {
    pkh: string;
    messageBytes: string;
    signature: string;
  };
}

export async function startMagicSquareQuest({ pkh, publicKey, messageBytes, signature, evm }: StartQuestPayload) {
  // Public Key Hashes

  if (!safeCheck(() => validateAddress(pkh) === ValidationResult.VALID && getPkhfromPk(publicKey) === pkh))
    throw new CodedError(StatusCodes.BAD_REQUEST, 'Invalid Tezos public key (hash)');

  let evmPkh: string;
  try {
    // Corrects lower-cased addresses. Throws if invalid.
    evmPkh = ethersAddressUtils.getAddress(evm.pkh);
  } catch (err) {
    console.error(err);
    throw new CodedError(StatusCodes.BAD_REQUEST, 'Invalid EVM public key hash');
  }

  // Nonce
  const { value: nonce } = getSigningNonce(pkh);
  const nonceBytes = Buffer.from(nonce, 'utf-8').toString('hex');

  if (!messageBytes.includes(nonceBytes))
    throw new CodedError(StatusCodes.UNAUTHORIZED, 'Invalid Tezos message nonce', 'INVALID_NONCE_TEZ');

  if (!evm.messageBytes.includes(nonceBytes))
    throw new CodedError(StatusCodes.UNAUTHORIZED, 'Invalid EVM message nonce', 'INVALID_NONCE_EVM');

  // Signatures

  if (!safeCheck(() => verifySignature(messageBytes, publicKey, signature)))
    throw new CodedError(StatusCodes.UNAUTHORIZED, 'Invalid Tezos signature or message');

  if (
    !safeCheck(() => {
      const messageBytes = ethersStringsUtils.toUtf8String(evm.messageBytes);
      const messageHash = ethersHashUtils.hashMessage(messageBytes);

      return ethersTxUtils.recoverAddress(messageHash, evm.signature) === evmPkh;
    })
  )
    throw new CodedError(StatusCodes.UNAUTHORIZED, 'Invalid EVM signature or message');

  // Presence check

  const exists = await redisClient
    .lrange(REDIS_DB_KEY, 0, -1)
    .then(items => items.some(item => item.includes(pkh) && item.includes(evmPkh)));

  if (exists) throw new CodedError(StatusCodes.CONFLICT, 'Your quest was already started before', 'QUEST_IS_STARTED');

  // Auth nonce
  removeSigningNonce(pkh);

  // Registering

  const item = {
    pkh,
    evmPkh,
    ts: new Date().toISOString()
  };

  await redisClient.lpush(REDIS_DB_KEY, JSON.stringify(item));
}
