import { getEnv } from './utils/env';

export const MIN_IOS_APP_VERSION = '1.10.445';
export const MIN_ANDROID_APP_VERSION = '1.10.445';

export const QUIPUSWAP_FA12_FACTORIES = getEnv('QUIPUSWAP_FA12_FACTORIES');
export const QUIPUSWAP_FA2_FACTORIES = getEnv('QUIPUSWAP_FA2_FACTORIES');
export const MOONPAY_SECRET_KEY = getEnv('MOONPAY_SECRET_KEY');
export const ALICE_BOB_PRIVATE_KEY = getEnv('ALICE_BOB_PRIVATE_KEY');
export const ALICE_BOB_PUBLIC_KEY = getEnv('ALICE_BOB_PUBLIC_KEY');
export const BINANCE_CONNECT_PRIVATE_KEY = getEnv('BINANCE_CONNECT_PRIVATE_KEY');
export const BINANCE_CONNECT_PUBLIC_KEY = getEnv('BINANCE_CONNECT_PUBLIC_KEY');

if (!Boolean(QUIPUSWAP_FA12_FACTORIES)) throw new Error('process.env.QUIPUSWAP_FA12_FACTORIES not found.');
if (!Boolean(QUIPUSWAP_FA2_FACTORIES)) throw new Error('process.env.QUIPUSWAP_FA2_FACTORIES not found.');
if (!Boolean(MOONPAY_SECRET_KEY)) throw new Error('process.env.MOONPAY_SECRET_KEY not found.');
if (!Boolean(ALICE_BOB_PRIVATE_KEY)) throw new Error('process.env.ALICE_BOB_PRIVATE_KEY not found.');
if (!Boolean(ALICE_BOB_PUBLIC_KEY)) throw new Error('process.env.ALICE_BOB_PUBLIC_KEY not found.');
if (!Boolean(BINANCE_CONNECT_PRIVATE_KEY)) throw new Error('process.env.BINANCE_CONNECT_PRIVATE_KEY not found.');
if (!Boolean(BINANCE_CONNECT_PUBLIC_KEY)) throw new Error('process.env.BINANCE_CONNECT_PUBLIC_KEY not found.');
