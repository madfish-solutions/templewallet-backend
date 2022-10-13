export const getAliceBobRequestHeaders = (signature: string, now: number) => ({
  'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
  'timestamp': now,
  signature
});
