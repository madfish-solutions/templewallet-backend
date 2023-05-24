import crypto from 'crypto';

import { EnvVars } from '../../config';

export const getSignedMoonPayUrl = (originalUrl: string) => {
  const signature = crypto
    .createHmac('sha256', EnvVars.MOONPAY_SECRET_KEY)
    .update(new URL(originalUrl).search)
    .digest('base64');

  return `${originalUrl}&signature=${encodeURIComponent(signature)}`;
};
