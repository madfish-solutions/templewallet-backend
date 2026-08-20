import { parse } from 'node-html-parser';
import { parentPort, workerData } from 'node:worker_threads';

import logger from '../utils/logger';

import { parseCryptoTokens } from './crypto';
import { parseFiatCurrencies } from './fiat';

const { html, cryptoTokenMetadata } = workerData;

logger.info('Parsing HTML');
const root = parse(html);

if (parentPort === null) {
  throw new Error('Parent port is not available');
}

parentPort.postMessage({
  cryptoTokens: parseCryptoTokens(root, cryptoTokenMetadata),
  fiatCurrencies: parseFiatCurrencies(root)
});
logger.info('Assets parsed');
