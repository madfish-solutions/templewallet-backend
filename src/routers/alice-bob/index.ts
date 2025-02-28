import { Router } from 'express';

import { getExternalApiErrorPayload, isDefined } from '../../utils/helpers';

import { cancelAliceBobOrder } from './utils/cancel-alice-bob-order';
import { createAliceBobOrder } from './utils/create-alice-bob-order';
import { estimateAliceBobOutput } from './utils/estimate-alice-bob-output';
import { getAliceBobEstimationPayload } from './utils/get-alice-bob-estimation-payload';
import { getAliceBobOrderInfo } from './utils/get-alice-bob-order-info';
import { getAliceBobPairInfo } from './utils/get-alice-bob-pair-info';
import { getAliceBobPairsInfo } from './utils/get-alice-bob-pairs-info';

export const aliceBobRouter = Router();

aliceBobRouter
  .get('/get-pairs-info', async (_req, res) => {
    const { isWithdraw } = _req.query;

    try {
      const pairsInfo = await getAliceBobPairsInfo(isWithdraw === 'true');

      res.status(200).send({ pairsInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .get('/get-pair-info', async (_req, res) => {
    const { isWithdraw } = _req.query;

    try {
      const pairInfo = await getAliceBobPairInfo(isWithdraw === 'true');

      res.status(200).send({ pairInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .post('/estimate-amount', async (_req, res) => {
    const { isWithdraw, amount, from, to } = _req.query;

    try {
      const payload = getAliceBobEstimationPayload(isWithdraw, from, to, amount);

      const outputAmount = await estimateAliceBobOutput(payload);

      res.status(200).send({ outputAmount });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send({ error: data });
    }
  })
  .get('/check-order', async (_req, res) => {
    const { orderId } = _req.query;

    try {
      const orderInfo = await getAliceBobOrderInfo(String(orderId));

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
        ...getAliceBobEstimationPayload(isWithdraw, from, to, amount),
        userId: String(userId),
        toPaymentDetails: isDefined(cardNumber) ? String(cardNumber) : String(walletAddress),
        redirectUrl: 'https://templewallet.com/mobile'
      };

      const orderInfo = await createAliceBobOrder(payload);

      res.status(200).send({ orderInfo });
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  })
  .post('/cancel-order', async (_req, res) => {
    const { orderId } = _req.query;

    try {
      await cancelAliceBobOrder({ id: String(orderId) });

      res.status(200);
    } catch (error) {
      const { status, data } = getExternalApiErrorPayload(error);
      res.status(status).send(data);
    }
  });
