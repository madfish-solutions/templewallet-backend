import crypto from 'crypto';

import { EnvVars } from '../../../config';

export const getSignedKoloWidgetUrl = (urlForSignature: string) => {
  const signature = crypto.createHmac('sha512', EnvVars.KOLO_API_SECRET).update(urlForSignature, 'utf8').digest('hex');

  const url = new URL(urlForSignature);
  url.searchParams.set('signature', signature);

  return url.toString();
};
