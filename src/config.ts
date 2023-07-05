import { getEnv } from './utils/env';
import { isDefined } from './utils/helpers';

export const MIN_IOS_APP_VERSION = '1.10.445';
export const MIN_ANDROID_APP_VERSION = '1.10.445';

export const MOONPAY_SECRET_KEY = getEnv('MOONPAY_SECRET_KEY');
export const ALICE_BOB_PRIVATE_KEY = getEnv('ALICE_BOB_PRIVATE_KEY');
export const ALICE_BOB_PUBLIC_KEY = getEnv('ALICE_BOB_PUBLIC_KEY');
export const THREE_ROUTE_API_URL = getEnv('THREE_ROUTE_API_URL');
export const THREE_ROUTE_API_AUTH_TOKEN = getEnv('THREE_ROUTE_API_AUTH_TOKEN');
export const REDIS_URL = getEnv('REDIS_URL');
export const ADD_NOTIFICATION_USERNAME = getEnv('ADD_NOTIFICATION_USERNAME');
export const ADD_NOTIFICATION_PASSWORD = getEnv('ADD_NOTIFICATION_PASSWORD');

const variablesToAssert = [
  { name: 'MOONPAY_SECRET_KEY', value: MOONPAY_SECRET_KEY },
  { name: 'ALICE_BOB_PRIVATE_KEY', value: ALICE_BOB_PRIVATE_KEY },
  { name: 'ALICE_BOB_PUBLIC_KEY', value: ALICE_BOB_PUBLIC_KEY },
  { name: 'THREE_ROUTE_API_URL', value: THREE_ROUTE_API_URL },
  { name: 'THREE_ROUTE_API_AUTH_TOKEN', value: THREE_ROUTE_API_AUTH_TOKEN },
  { name: 'REDIS_URL', value: REDIS_URL },
  { name: 'ADD_NOTIFICATION_USERNAME', value: ADD_NOTIFICATION_USERNAME },
  { name: 'ADD_NOTIFICATION_PASSWORD', value: ADD_NOTIFICATION_PASSWORD }
];
variablesToAssert.forEach(({ name, value }) => {
  if (!isDefined(value)) {
    throw new Error(`process.env.${name} not found.`);
  }
});
