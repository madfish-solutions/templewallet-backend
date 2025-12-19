import { Router } from 'express';
import * as yup from 'yup';

import logger from '../../utils/logger';

import { koloRequest } from './utils/kolo-request';
import { getSignedKoloWidgetUrl } from './utils/sign-widget-url';
import { registerKoloWebhookRoute } from './webhook';

export const koloRouter = Router();

interface CryptoAddressRetrievalResponse {
  address: string;
  memo?: string;
}

const cryptoAddressQuerySchema = yup
  .object({
    email: yup.string().min(4).max(320).required(),
    payway: yup.string().min(1).max(255).required()
  })
  .required();

koloRouter.post('/widget-sign', async (req, res) => {
  try {
    const { urlForSignature } = req.body ?? {};
    if (typeof urlForSignature !== 'string' || urlForSignature.length === 0) {
      return res.status(400).send({ error: 'urlForSignature is required' });
    }

    const signedUrl = getSignedKoloWidgetUrl(urlForSignature);

    return res.status(200).send({ signedUrl });
  } catch (error) {
    res.status(500).send({ error });
  }
});

koloRouter.get('/crypto-address', async (req, res) => {
  try {
    const { email, payway } = await cryptoAddressQuerySchema.validate(req.query, { abortEarly: false });

    const payload = await koloRequest<CryptoAddressRetrievalResponse>({
      method: 'GET',
      path: '/api/card-frame-s2s/v1/crypto-address',
      query: { email, payway }
    });

    return res.status(200).send(payload);
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).send({ error: 'Invalid query params', details: error.errors });
    }

    logger.error({ error }, '[KOLO] Failed to get crypto address for top-up');

    return res.status(500).send({ error: error?.message ?? 'Failed to get crypto address for top-up' });
  }
});

registerKoloWebhookRoute(koloRouter);

export default koloRouter;
