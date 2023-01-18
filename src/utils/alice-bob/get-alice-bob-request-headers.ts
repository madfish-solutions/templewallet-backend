import { ALICE_BOB_PUBLIC_KEY } from '../../config';

export const getAliceBobRequestHeaders = (signature: string, now: number) => ({
  'public-key': ALICE_BOB_PUBLIC_KEY,
  timestamp: now,
  signature
});
