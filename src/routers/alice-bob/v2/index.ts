import { Router } from 'express';

import { withExternalApiExceptionHandler } from '../../../utils/express-helpers';

import { createOrder } from './utils/create-order';
import { estimateOutput } from './utils/estimate-output';
import { getEstimationPayload } from './utils/get-estimation-payload';
import { getPairsInfo } from './utils/get-pairs-info';

export const aliceBobV2Router = Router();

aliceBobV2Router
  .get(
    '/get-pairs-info',
    withExternalApiExceptionHandler(async (_req, res) => {
      const pairsInfo = await getPairsInfo();

      res.status(200).send({ pairsInfo });
    })
  )
  .post(
    '/estimate-amount',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { amount, from, to } = _req.query;

      const payload = getEstimationPayload(from, to, amount);

      const outputAmount = await estimateOutput(payload);

      res.status(200).send({ outputAmount });
    })
  )
  .post(
    '/create-order',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { amount, from, to, userId, walletAddress } = _req.query;

      const payload = {
        ...getEstimationPayload(from, to, amount),
        userId: String(userId),
        toPaymentDetails: String(walletAddress),
        redirectUrl: 'https://templewallet.com'
      };

      const orderInfo = await createOrder(payload);

      res.status(200).send({ orderInfo });
    })
  );
