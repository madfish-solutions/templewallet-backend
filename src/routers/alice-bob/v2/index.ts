import { Router } from 'express';

import { getExternalApiErrorPayload } from '../../../utils/helpers';

import { createOrder } from './utils/create-order';
import { estimateOutput } from './utils/estimate-output';
import { getEstimationPayload } from './utils/get-estimation-payload';
import { getPairsInfo } from './utils/get-pairs-info';

export const aliceBobV2Router = Router();

aliceBobV2Router
  .get('/get-pairs-info', async (_req, res) => {
    try {
      const pairsInfo = await getPairsInfo();

      res.status(200).send({ pairsInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .post('/estimate-amount', async (_req, res) => {
    const { amount, from, to } = _req.query;

    try {
      const payload = getEstimationPayload(from, to, amount);

      const outputAmount = await estimateOutput(payload);

      res.status(200).send({ outputAmount });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send({ error: data });
    }
  })
  .post('/create-order', async (_req, res) => {
    const { amount, from, to, userId, walletAddress } = _req.query;

    try {
      const payload = {
        ...getEstimationPayload(from, to, amount),
        userId: String(userId),
        toPaymentDetails: String(walletAddress),
        redirectUrl: 'https://templewallet.com'
      };

      const orderInfo = await createOrder(payload);

      res.status(200).send({ orderInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  });
