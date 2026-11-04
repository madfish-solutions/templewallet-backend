import { isDefined, isNonEmptyString } from '../helpers';

import { ObjktTokenHolder, ObjktTokenMovement } from './types';

const addQuantity = (quantities: Map<string, number>, address: string | undefined, delta: number) => {
  if (!isNonEmptyString(address)) {
    return;
  }

  quantities.set(address, (quantities.get(address) ?? 0) + delta);
};

const undoMovement = (quantities: Map<string, number>, movement: ObjktTokenMovement) => {
  addQuantity(quantities, movement.recipient, -movement.amount);
  addQuantity(quantities, movement.sender, movement.amount);
};

export const holdersAtOfferTime = ({
  tokenPk,
  at,
  creatorAddress,
  currentHolders,
  movements,
  sameBlockMovementsAfter = []
}: {
  tokenPk: number;
  at: string;
  creatorAddress: string | null | undefined;
  currentHolders: ObjktTokenHolder[];
  movements: ObjktTokenMovement[];
  /** Transfers and mints from the offer's block that executed after the offer. */
  sameBlockMovementsAfter?: ObjktTokenMovement[];
}) => {
  const atMs = Date.parse(at);
  const quantities = new Map<string, number>();

  for (const holder of currentHolders) {
    if (holder.tokenPk === tokenPk && holder.quantity > 0) {
      addQuantity(quantities, holder.address, holder.quantity);
    }
  }

  for (const movement of movements) {
    if (movement.tokenPk === tokenPk && Date.parse(movement.timestamp) > atMs) {
      undoMovement(quantities, movement);
    }
  }

  for (const movement of sameBlockMovementsAfter) {
    if (movement.tokenPk === tokenPk) {
      undoMovement(quantities, movement);
    }
  }

  return Array.from(quantities.entries())
    .filter(([address, quantity]) => quantity > 0 && address !== creatorAddress)
    .map(([address]) => address);
};

export const uniqueTokenPks = (tokenPks: Array<number | null | undefined>) =>
  Array.from(new Set(tokenPks.filter((tokenPk): tokenPk is number => isDefined(tokenPk))));
