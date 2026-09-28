import * as yup from 'yup';

import { isDefined, isNonEmptyString } from '../helpers';
import { getTzktTokenTransfers, getTzktTransactionsByHash, TzktTokenTransfer, TzktTransaction } from '../tzkt';

import { ObjktTokenMovement } from './types';

const TZKT_PAGE_LIMIT = 1000;

export interface SameBlockOffer {
  id: number;
  level: number;
  ophash: string;
  timestamp: string;
  tokenPk: number;
  faContract: string;
  tokenId: string;
}

const tokenKey = (offer: SameBlockOffer) => `${offer.level}:${offer.faContract}:${offer.tokenId}`;

const offerKey = (offer: SameBlockOffer) => `${offer.ophash}:${offer.faContract}:${offer.tokenId}`;

const offerParameterSchema = yup
  .object({
    token: yup
      .object({
        address: yup.string().defined(),
        token_id: yup
          .mixed<string | number>()
          .defined()
          .test('token-id', value => typeof value === 'string' || typeof value === 'number')
      })
      .required()
  })
  .required();

const readOfferToken = (value: unknown) => {
  try {
    const { token } = offerParameterSchema.validateSync(value, { strict: true });

    return { address: token.address, tokenId: String(token.token_id) };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return undefined;
    }

    throw error;
  }
};

export const findOfferTransactionId = (
  transactions: TzktTransaction[],
  faContract: string,
  tokenId: string
): number | undefined => {
  const offerCalls = transactions.filter(transaction => transaction.parameter?.entrypoint === 'offer');
  const matched = offerCalls.find(transaction => {
    const token = readOfferToken(transaction.parameter?.value);

    return token?.address === faContract && token.tokenId === tokenId;
  });
  if (isDefined(matched)) {
    return matched.id;
  }

  if (offerCalls.length === 1) {
    return offerCalls[0].id;
  }

  return undefined;
};

const toPositiveAmount = (amount: string) => {
  const parsed = Number(amount);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const movementsAfterTransaction = (
  tokenPk: number,
  offerTransactionId: number,
  transfers: TzktTokenTransfer[]
): ObjktTokenMovement[] =>
  transfers.flatMap(transfer => {
    const amount = toPositiveAmount(transfer.amount);
    const sender = transfer.from?.address;
    const recipient = transfer.to?.address;
    if (
      !isDefined(transfer.transactionId) ||
      transfer.transactionId <= offerTransactionId ||
      !isDefined(amount) ||
      (!isNonEmptyString(sender) && !isNonEmptyString(recipient))
    ) {
      return [];
    }

    return [
      {
        tokenPk,
        timestamp: transfer.timestamp,
        amount,
        sender: isNonEmptyString(sender) ? sender : undefined,
        recipient: isNonEmptyString(recipient) ? recipient : undefined
      }
    ];
  });

const fetchOfferTransactionId = async (offer: SameBlockOffer) => {
  const transactions = await getTzktTransactionsByHash({ hash: offer.ophash });
  const transactionId = findOfferTransactionId(transactions, offer.faContract, offer.tokenId);
  if (!isDefined(transactionId)) {
    throw new Error(`Unable to place Objkt offer ${offer.ophash} in block ${offer.level}`);
  }

  return transactionId;
};

const fetchTokenTransfersInBlock = async (offer: SameBlockOffer) => {
  const transfers: TzktTokenTransfer[] = [];
  let offset = 0;

  while (true) {
    const page = await getTzktTokenTransfers({
      level: offer.level,
      contract: offer.faContract,
      tokenId: offer.tokenId,
      limit: TZKT_PAGE_LIMIT,
      offset
    });

    transfers.push(...page);
    if (page.length < TZKT_PAGE_LIMIT) {
      return transfers;
    }

    offset += TZKT_PAGE_LIMIT;
  }
};

/**
 * Objkt event ids are not execution order inside a block: one operation's events can be
 * interleaved with a later operation. TzKT transaction ids follow the order operations ran.
 */
export const getSameBlockMovementsAfterOffers = async (offers: SameBlockOffer[]) => {
  const movementsByOfferId = new Map<number, ObjktTokenMovement[]>();
  if (offers.length === 0) {
    return movementsByOfferId;
  }

  const uniqueOffers = new Map<string, SameBlockOffer>();
  const uniqueTokens = new Map<string, SameBlockOffer>();
  for (const offer of offers) {
    uniqueOffers.set(offerKey(offer), offer);
    uniqueTokens.set(tokenKey(offer), offer);
  }

  const offerTransactionIds = new Map<string, number>();
  const transfersByToken = new Map<string, TzktTokenTransfer[]>();

  await Promise.all(
    Array.from(uniqueOffers.values()).map(async offer => {
      offerTransactionIds.set(offerKey(offer), await fetchOfferTransactionId(offer));
    })
  );
  await Promise.all(
    Array.from(uniqueTokens.values()).map(async offer => {
      transfersByToken.set(tokenKey(offer), await fetchTokenTransfersInBlock(offer));
    })
  );

  for (const offer of offers) {
    const offerTransactionId = offerTransactionIds.get(offerKey(offer));
    const transfers = transfersByToken.get(tokenKey(offer));
    if (!isDefined(offerTransactionId) || !isDefined(transfers)) {
      throw new Error(`Missing TzKT order for Objkt offer ${offer.id}`);
    }

    movementsByOfferId.set(offer.id, movementsAfterTransaction(offer.tokenPk, offerTransactionId, transfers));
  }

  return movementsByOfferId;
};
