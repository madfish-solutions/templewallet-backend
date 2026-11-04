import { validateAddress, ValidationResult } from '@taquito/utils';
import * as yup from 'yup';

import { isDefined, isNonEmptyString } from '../utils/helpers';

export const MAX_NOTIFICATION_ACCOUNT_ADDRESSES = 100;

const toAccountAddresses = (value: unknown): unknown => {
  if (!isDefined(value) || value === '') {
    return [];
  }

  const items = Array.isArray(value) ? value : [value];
  if (!items.every(item => typeof item === 'string')) {
    return items;
  }

  return items.flatMap(item =>
    item
      .split(',')
      .map(address => address.trim())
      .filter(isNonEmptyString)
  );
};

const tezosAddressSchema = yup
  .string()
  .trim()
  .required()
  .test(
    'tezos-address',
    'Invalid account address',
    address => isNonEmptyString(address) && validateAddress(address) === ValidationResult.VALID
  );

export const accountAddressesSchema = yup
  .array()
  .of(tezosAddressSchema)
  .transform(toAccountAddresses)
  .max(
    MAX_NOTIFICATION_ACCOUNT_ADDRESSES,
    `No more than ${MAX_NOTIFICATION_ACCOUNT_ADDRESSES} account addresses are allowed`
  )
  .test('unique', 'Account addresses must be unique', addresses => {
    if (!isDefined(addresses)) {
      return true;
    }

    return new Set(addresses).size === addresses.length;
  })
  .default([]);
