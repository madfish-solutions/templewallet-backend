import { NextFunction, Request, Response } from 'express';
import * as yup from 'yup';

import { accountAddressesSchema } from '../notifications/account-addresses.schema';
import { PlatformType } from '../notifications/notification.interface';

export { MAX_NOTIFICATION_ACCOUNT_ADDRESSES } from '../notifications/account-addresses.schema';

interface NotificationsQuery {
  platform: PlatformType;
  startFromTime: number;
  /** Cursor id for account/Objkt notifications only. Broadcast items are filtered by `startFromTime`. */
  startID: number;
  accountAddresses: string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    notificationsQuery: NotificationsQuery;
  }
}

const toNonNegativeNumber = (value: unknown, originalValue: unknown) =>
  originalValue === undefined || originalValue === '' ? 0 : value;

export const notificationsQuerySchema = yup
  .object({
    platform: yup
      .mixed<PlatformType>()
      .transform(value => (value === PlatformType.Mobile ? PlatformType.Mobile : PlatformType.Extension))
      .default(PlatformType.Extension),
    startFromTime: yup.number().transform(toNonNegativeNumber).min(0).default(0),
    // Broadcast notification ids are createdAt millis and cannot share a cursor with Objkt event ids.
    startID: yup.number().transform(toNonNegativeNumber).integer().min(0).default(0),
    accountAddresses: accountAddressesSchema
  })
  .required();

export const validateGetNotificationsQuery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.notificationsQuery = await notificationsQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });
    next();
  } catch (error: unknown) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).send({ error: 'Invalid query params', details: error.errors });
    }

    next(error);
  }
};
