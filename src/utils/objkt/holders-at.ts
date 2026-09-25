import { isDefined, isNonEmptyString } from '../helpers';

import { ObjktTokenHolder, ObjktTokenTransfer } from './types';

const addQuantity = (quantities: Map<string, number>, address: string, delta: number) => {
  if (!isNonEmptyString(address)) {
    return;
  }

  quantities.set(address, (quantities.get(address) ?? 0) + delta);
};

export const holdersAtOfferTime = ({
  tokenPk,
  at,
  creatorAddress,
  currentHolders,
  transfers
}: {
  tokenPk: number;
  at: string;
  creatorAddress: string | null | undefined;
  currentHolders: ObjktTokenHolder[];
  transfers: ObjktTokenTransfer[];
}) => {
  const atMs = Date.parse(at);
  const quantities = new Map<string, number>();

  for (const holder of currentHolders) {
    if (holder.tokenPk === tokenPk && holder.quantity > 0) {
      addQuantity(quantities, holder.address, holder.quantity);
    }
  }

  const laterTransfers = transfers
    .filter(transfer => transfer.tokenPk === tokenPk && Date.parse(transfer.timestamp) > atMs)
    .sort((left, right) => right.id - left.id);

  for (const transfer of laterTransfers) {
    addQuantity(quantities, transfer.recipient, -transfer.amount);
    addQuantity(quantities, transfer.sender, transfer.amount);
  }

  return Array.from(quantities.entries())
    .filter(([address, quantity]) => quantity > 0 && address !== creatorAddress)
    .map(([address]) => address);
};

export const uniqueTokenPks = (tokenPks: Array<number | null | undefined>) =>
  Array.from(new Set(tokenPks.filter((tokenPk): tokenPk is number => isDefined(tokenPk))));
