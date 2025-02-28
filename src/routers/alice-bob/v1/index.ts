import { Router } from 'express';

import { withExternalApiExceptionHandler } from '../../../utils/express-helpers';
import { isDefined } from '../../../utils/helpers';

import { cancelOrder } from './utils/cancel-order';
import { createOrder } from './utils/create-order';
import { estimateOutput } from './utils/estimate-output';
import { getEstimationPayload } from './utils/get-estimation-payload';
import { getOrderInfo } from './utils/get-order-info';
import { getPairInfo } from './utils/get-pair-info';
import { getPairsInfo } from './utils/get-pairs-info';

export const aliceBobRouter = Router();

aliceBobRouter
  .get(
    '/get-pairs-info',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { isWithdraw } = _req.query;

      const pairsInfo = await getPairsInfo(isWithdraw === 'true');

      res.status(200).send({ pairsInfo });
    })
  )
  .get(
    '/get-pair-info',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { isWithdraw } = _req.query;

      const pairInfo = await getPairInfo(isWithdraw === 'true');

      res.status(200).send({ pairInfo });
    })
  )
  .post(
    '/estimate-amount',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { isWithdraw, amount, from, to } = _req.query;

      const payload = getEstimationPayload(isWithdraw, from, to, amount);

      const outputAmount = await estimateOutput(payload);

      res.status(200).send({ outputAmount });
    })
  )
  .get(
    '/check-order',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { orderId } = _req.query;

      const orderInfo = await getOrderInfo(String(orderId));

      res.status(200).send({ orderInfo });
    })
  )
  .post(
    '/create-order',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { isWithdraw, amount, from, to, userId, walletAddress, cardNumber } = _req.query;

      const payload = {
        ...getEstimationPayload(isWithdraw, from, to, amount),
        userId: String(userId),
        toPaymentDetails: isDefined(cardNumber) ? String(cardNumber) : String(walletAddress),
        redirectUrl: 'https://templewallet.com/mobile'
      };

      const orderInfo = await createOrder(payload);

      res.status(200).send({ orderInfo });
    })
  )
  .post(
    '/cancel-order',
    withExternalApiExceptionHandler(async (_req, res) => {
      const { orderId } = _req.query;

      await cancelOrder({ id: String(orderId) });

      res.status(200);
    })
  );
