import NodeRSA from 'node-rsa';

import { BINANCE_CONNECT_PRIVATE_KEY, BINANCE_CONNECT_PUBLIC_KEY } from '../config';
import { MERCHANT_CODE } from './config';

export async function buildGetSignature(timestamp: number, merchant_code = MERCHANT_CODE) {
  return sign(`merchantCode=${merchant_code}&timestamp=${timestamp}`);
}

export async function buildPostSignature(payload: string, timestamp: number, merchant_code = MERCHANT_CODE) {
  return sign(`${payload}&merchantCode=${merchant_code}&timestamp=${timestamp}`);
}

const signer = new NodeRSA(BINANCE_CONNECT_PRIVATE_KEY, 'pkcs8-private-pem', { signingScheme: 'pkcs1-sha256' });
const verifier = new NodeRSA(BINANCE_CONNECT_PUBLIC_KEY, 'pkcs8-public-pem', { signingScheme: 'pkcs1-sha256' });

/** Private key is an RSA PKCS8, PEM-encoded string value */
export function sign(rawData: string) {
  return signer.sign(rawData).toString('base64');
}

export function validate(rawData: string, sign: string) {
  return verifier.verify(rawData, Buffer.from(sign, 'base64'));
}
