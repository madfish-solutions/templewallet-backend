import * as yup from 'yup';

import {
  ACCOUNT_NOTIFICATION_TYPES,
  AccountNotification,
  AccountNotificationType,
  NotificationLink,
  PlatformType
} from './notification.interface';

const accountNotificationTypeSchema = yup.mixed<AccountNotificationType>().oneOf(ACCOUNT_NOTIFICATION_TYPES).required();

const platformTypeSchema = yup.mixed<PlatformType>().oneOf(Object.values(PlatformType)).required();

const notificationLinkSchema: yup.ObjectSchema<NotificationLink> = yup
  .object({
    text: yup.string().required(),
    url: yup.string().required()
  })
  .required();

const notificationContentItemSchema = yup.lazy((value: unknown) =>
  typeof value === 'string' ? yup.string().required() : notificationLinkSchema
);

export const storedAccountNotificationSchema: yup.ObjectSchema<Omit<AccountNotification, 'accountAddresses'>> = yup
  .object({
    id: yup.number().required(),
    createdAt: yup.string().required(),
    type: accountNotificationTypeSchema,
    platforms: yup.array().of(platformTypeSchema).required(),
    language: yup.string().required(),
    title: yup.string().required(),
    description: yup.string().required(),
    content: yup.array().of(notificationContentItemSchema).required(),
    extensionImageUrl: yup.string().required(),
    mobileImageUrl: yup.string().required(),
    sourceUrl: yup.string().optional(),
    expirationDate: yup.string().optional(),
    isMandatory: yup.boolean().optional()
  })
  .required();

export const accountNotificationEventSchema: yup.ObjectSchema<AccountNotification> =
  storedAccountNotificationSchema.concat(
    yup.object({
      accountAddresses: yup.array().of(yup.string().required()).required()
    })
  );

export const accountNotificationEventsSchema = yup
  .array()
  .transform((value: unknown) =>
    Array.isArray(value) ? value.filter(item => accountNotificationEventSchema.isValidSync(item)) : []
  )
  .of(accountNotificationEventSchema)
  .required();
