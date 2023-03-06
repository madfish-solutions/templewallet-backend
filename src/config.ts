import { assert } from 'console';

import { getEnv } from './utils/env';

export const MIN_IOS_APP_VERSION = '1.10.445';
export const MIN_ANDROID_APP_VERSION = '1.10.445';

export const MOONPAY_SECRET_KEY = getEnv('MOONPAY_SECRET_KEY');
export const ALICE_BOB_PRIVATE_KEY = getEnv('ALICE_BOB_PRIVATE_KEY');
export const ALICE_BOB_PUBLIC_KEY = getEnv('ALICE_BOB_PUBLIC_KEY');
export const THREE_ROUTE_API_URL = getEnv('THREE_ROUTE_API_URL');
export const THREE_ROUTE_API_AUTH_TOKEN = getEnv('THREE_ROUTE_API_AUTH_TOKEN');

const variablesToAssert = [
  { name: 'MOONPAY_SECRET_KEY', value: MOONPAY_SECRET_KEY },
  { name: 'ALICE_BOB_PRIVATE_KEY', value: ALICE_BOB_PRIVATE_KEY },
  { name: 'ALICE_BOB_PUBLIC_KEY', value: ALICE_BOB_PUBLIC_KEY },
  { name: 'THREE_ROUTE_API_URL', value: THREE_ROUTE_API_URL },
  { name: 'THREE_ROUTE_API_AUTH_TOKEN', value: THREE_ROUTE_API_AUTH_TOKEN }
];
variablesToAssert.forEach(({ name, value }) => assert(value, `process.env.${name} not found.`));
