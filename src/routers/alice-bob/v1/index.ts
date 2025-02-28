import { Router } from 'express';

import { getExternalApiErrorPayload, isDefined } from '../../../utils/helpers';

import { cancelOrder } from './utils/cancel-order';
import { createOrder } from './utils/create-order';
import { estimateOutput } from './utils/estimate-output';
import { getEstimationPayload } from './utils/get-estimation-payload';
import { getOrderInfo } from './utils/get-order-info';
import { getPairInfo } from './utils/get-pair-info';
import { getPairsInfo } from './utils/get-pairs-info';

export const aliceBobRouter = Router();

aliceBobRouter
  .get('/get-pairs-info', async (_req, res) => {
    const { isWithdraw } = _req.query;

    try {
      const pairsInfo = await getPairsInfo(isWithdraw === 'true');

      res.status(200).send({ pairsInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .get('/get-pair-info', async (_req, res) => {
    const { isWithdraw } = _req.query;

    try {
      const pairInfo = await getPairInfo(isWithdraw === 'true');

      res.status(200).send({ pairInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .post('/estimate-amount', async (_req, res) => {
    const { isWithdraw, amount, from, to } = _req.query;

    try {
      const payload = getEstimationPayload(isWithdraw, from, to, amount);

      const outputAmount = await estimateOutput(payload);

      res.status(200).send({ outputAmount });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send({ error: data });
    }
  })
  .get('/check-order', async (_req, res) => {
    const { orderId } = _req.query;

    try {
      const orderInfo = await getOrderInfo(String(orderId));

      res.status(200).send({ orderInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send({ error: data });
    }
  })
  .post('/create-order', async (_req, res) => {
    const { isWithdraw, amount, from, to, userId, walletAddress, cardNumber } = _req.query;

    try {
      const payload = {
        ...getEstimationPayload(isWithdraw, from, to, amount),
        userId: String(userId),
        toPaymentDetails: isDefined(cardNumber) ? String(cardNumber) : String(walletAddress),
        redirectUrl: 'https://templewallet.com/mobile'
      };

      const orderInfo = await createOrder(payload);

      res.status(200).send({ orderInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .post('/cancel-order', async (_req, res) => {
    const { orderId } = _req.query;

    try {
      await cancelOrder({ id: String(orderId) });

      res.status(200);
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  });
