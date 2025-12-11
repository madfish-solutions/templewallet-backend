import crypto from 'crypto';

import { EnvVars } from '../../../config';

const toBytes = (value: string) => Buffer.from(value, 'utf8');

export const generateKoloRequestSignature = (params: {
  path: string;
  queryString: string;
  body: string;
  timestamp: number;
}) => {
  const { path, queryString, body, timestamp } = params;

  const target = Buffer.concat([toBytes(path), toBytes(queryString), toBytes(body), toBytes(String(timestamp))]);

  const hmac = crypto.createHmac('sha512', EnvVars.KOLO_API_PRIVATE_KEY);
  hmac.update(target);

  return hmac.digest('hex');
};
