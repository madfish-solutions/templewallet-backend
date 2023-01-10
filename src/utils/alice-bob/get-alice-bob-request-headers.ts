export const getAliceBobRequestHeaders = (signature: string, now: number) => ({
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
  timestamp: now,
  signature
});
