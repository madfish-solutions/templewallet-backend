import * as ethersAddressUtils from '@ethersproject/address';
import * as ethersHashUtils from '@ethersproject/hash';
import * as ethersStringsUtils from '@ethersproject/strings';
import * as ethersTxUtils from '@ethersproject/transactions';
import { verifySignature, getPkhfromPk } from '@taquito/utils';
import { StatusCodes } from 'http-status-codes';

import { objectStorageMethodsFactory } from './redis';
import { getSigningNonce, removeSigningNonce } from './sig-auth';
import { CodedError } from './utils/errors';
import { safeCheck } from './utils/helpers';

interface Participant {
  pkh: string;
  evmPkh: string;
  ts: string;
}

const REDIS_DB_KEY = 'magic_square_quest';

const redisStorage = objectStorageMethodsFactory<Participant, null>(REDIS_DB_KEY, null);

export function getMagicSquareQuestParticipants() {
  return redisStorage.getAllValues().then(records => Object.values(records));
}

interface StartQuestPayload {
  publicKey: string;
  messageBytes: string;
  signature: string;
  evm: {
    pkh: string;
    messageBytes: string;
    signature: string;
  };
}

export async function startMagicSquareQuest({ publicKey, messageBytes, signature, evm }: StartQuestPayload) {
  // Public Key Hashes

  let pkh: string;
  try {
    pkh = getPkhfromPk(publicKey);
  } catch (err) {
    console.error(err);
    throw new CodedError(StatusCodes.BAD_REQUEST, 'Invalid Tezos public key');
  }

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

  const storageKey = `${pkh}+${evmPkh}`;

  const existingValue = await redisStorage.getByKey(storageKey);

  if (existingValue)
    throw new CodedError(StatusCodes.CONFLICT, 'Your quest was already started before', 'QUEST_IS_STARTED');

  // Invalidating nonce
  removeSigningNonce(pkh);

  // Registering

  const participant: Participant = {
    pkh,
    evmPkh,
    ts: new Date().toISOString()
  };

  await redisStorage.upsertValues({ [storageKey]: participant });
}
