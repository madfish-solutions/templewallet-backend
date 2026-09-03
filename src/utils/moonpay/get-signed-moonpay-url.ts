import crypto from 'crypto';

import { EnvVars } from '../../config';

const toHashSignature = (data: string) =>
  crypto.createHmac('sha256', EnvVars.MOONPAY_SECRET_KEY).update(data).digest('base64');

export const getSignedMoonPayUrl = (originalUrl: string, ipAddress: string) => {
  const ipHash = toHashSignature(ipAddress);

  const url = new URL(originalUrl);
  url.searchParams.set('allowedIpAddress', ipHash);
  const signature = toHashSignature(url.search);
  url.searchParams.set('signature', signature);

  return url.toString();
};
