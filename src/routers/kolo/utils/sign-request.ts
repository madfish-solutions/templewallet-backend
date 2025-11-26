import crypto from 'crypto';

import { EnvVars } from '../../../config';

const toBytes = (value: string) => Buffer.from(value, 'utf8');

/**
 * Generates KOLO API request signature according to the reference algorithm:
 *
 *   target = path + query_string + body + timestamp
 *   signature = HMAC_SHA512(target, KOLO_API_SECRET)
 *
 * - `path` should not contain the query string part.
 * - `query_string` should not include leading '?' (may be empty string).
 * - `body` is the exact JSON string being sent as the request body (empty string if no body).
 * - `timestamp` is a millisecond-precision unix timestamp.
 */
export const generateKoloRequestSignature = (params: {
  path: string;
  queryString: string;
  body: string;
  timestamp: number;
}) => {
  const { path, queryString, body, timestamp } = params;

  const target = Buffer.concat([toBytes(path), toBytes(queryString), toBytes(body), toBytes(String(timestamp))]);

  const hmac = crypto.createHmac('sha512', EnvVars.KOLO_API_SECRET);
  hmac.update(target);

  return hmac.digest('hex');
};
