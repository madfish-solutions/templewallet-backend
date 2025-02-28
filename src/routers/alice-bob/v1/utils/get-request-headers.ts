import { EnvVars } from '../../../../config';

export const getRequestHeaders = (signature: string, now: number) => ({
  'public-key': EnvVars.ALICE_BOB_PUBLIC_KEY,
  timestamp: now,
  signature
});
