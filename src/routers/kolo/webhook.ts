import { Router, Request, Response } from 'express';
import * as yup from 'yup';

import logger from '../../utils/logger';

export interface UserVerificationWebhookEventPayload {
  expires_at?: number;
  review_comment?: string;
}

export type UserVerificationEventType =
  | 'verification.reset'
  | 'verification.rejected'
  | 'verification.completed'
  | 'verification.retry_required'
  | 'verification.on_hold';

export interface UserVerificationWebhookEvent {
  event_id?: string;
  event: UserVerificationEventType;
  user_email: string;
  payload: UserVerificationWebhookEventPayload;
}

export type CardEventType = 'card.issued' | 'card.provisioning.completed';

export interface CardWebhookEventPayload {
  uuid: string;
  currency: string;
  brand: 'MASTERCARD' | 'VISA';
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCK_INIT' | 'BLOCK_COMPLETED' | 'CLOSED';
  mask: string;
}

export interface CardWebhookEvent {
  event_id?: string;
  event: CardEventType;
  user_email: string;
  payload: CardWebhookEventPayload;
}

const userVerificationWebhookSchema: yup.ObjectSchema<UserVerificationWebhookEvent> = yup
  .object({
    event_id: yup.string().uuid().optional(),
    event: yup
      .mixed<UserVerificationEventType>()
      .oneOf([
        'verification.reset',
        'verification.rejected',
        'verification.completed',
        'verification.retry_required',
        'verification.on_hold'
      ])
      .required(),
    user_email: yup.string().email().required(),
    payload: yup
      .object({
        expires_at: yup.number().optional(),
        review_comment: yup.string().optional()
      })
      .required()
  })
  .required();

const cardWebhookSchema: yup.ObjectSchema<CardWebhookEvent> = yup
  .object({
    event_id: yup.string().uuid().optional(),
    event: yup.mixed<CardEventType>().oneOf(['card.issued', 'card.provisioning.completed']).required(),
    user_email: yup.string().email().required(),
    payload: yup
      .object({
        uuid: yup.string().required(),
        currency: yup.string().required(),
        brand: yup.mixed<CardWebhookEventPayload['brand']>().oneOf(['MASTERCARD', 'VISA']).required(),
        status: yup
          .mixed<CardWebhookEventPayload['status']>()
          .oneOf(['ACTIVE', 'INACTIVE', 'BLOCK_INIT', 'BLOCK_COMPLETED', 'CLOSED'])
          .required(),
        mask: yup.string().min(13).max(20).required()
      })
      .required()
  })
  .required();

export const registerKoloWebhookRoute = (koloRouter: Router) => {
  koloRouter.post('/webhook', async (req: Request, res: Response) => {
    try {
      const body = req.body;

      const isUserVerificationEvent = typeof body?.event === 'string' && body.event.startsWith('verification.');
      const isCardEvent = typeof body?.event === 'string' && body.event.startsWith('card.');

      if (!Boolean(isUserVerificationEvent) && !Boolean(isCardEvent)) {
        logger.warn({ body }, '[KOLO] Webhook received with unknown event type');

        return res.status(400).send({ error: 'Unknown KOLO webhook event type' });
      }

      if (Boolean(isUserVerificationEvent)) {
        const event = await userVerificationWebhookSchema.validate(body, { abortEarly: false });

        logger.info(
          {
            event: event.event,
            userEmail: event.user_email,
            expiresAt: event.payload.expires_at,
            reviewComment: event.payload.review_comment
          },
          '[KOLO] User verification webhook event'
        );
      } else if (Boolean(isCardEvent)) {
        const event = await cardWebhookSchema.validate(body, { abortEarly: false });

        logger.info(
          {
            event: event.event,
            userEmail: event.user_email,
            cardUuid: event.payload.uuid,
            currency: event.payload.currency,
            brand: event.payload.brand,
            status: event.payload.status,
            mask: event.payload.mask
          },
          '[KOLO] Card webhook event'
        );
      }

      res.status(200).send({ ok: true });
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        logger.warn({ error, body: req.body }, '[KOLO] Invalid webhook payload');

        return res.status(400).send({ error: 'Invalid webhook payload', details: error.errors });
      }

      logger.error({ error }, '[KOLO] Webhook handler error');
      res.status(500).send({ error: error.message ?? 'Webhook handler error' });
    }
  });
};
