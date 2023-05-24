import { isTruthy } from './utils/helpers';

export const MIN_IOS_APP_VERSION = '1.10.445';
export const MIN_ANDROID_APP_VERSION = '1.10.445';

const EnvVarsNames = [
  'QUIPUSWAP_FA12_FACTORIES',
  'QUIPUSWAP_FA2_FACTORIES',
  'MOONPAY_SECRET_KEY',
  'ALICE_BOB_PRIVATE_KEY',
  'ALICE_BOB_PUBLIC_KEY',
  'BINANCE_CONNECT_PRIVATE_KEY',
  'BINANCE_CONNECT_PUBLIC_KEY'
] as const;

type EnvVarsType = {
  [key in (typeof EnvVarsNames)[number]]: string;
};

export const EnvVars = Object.fromEntries(
  EnvVarsNames.map(name => {
    const value = process.env[name];

    if (!isTruthy(value)) throw new Error(`process.env.${name} not found.`);

    return [name, value];
  })
) as EnvVarsType;
