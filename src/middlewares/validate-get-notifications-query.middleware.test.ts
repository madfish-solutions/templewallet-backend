import { b58cencode, prefix } from '@taquito/utils';
import { randomBytes } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { PlatformType } from '../notifications/notification.interface';

import {
  MAX_NOTIFICATION_ACCOUNT_ADDRESSES,
  notificationsQuerySchema,
  validateGetNotificationsQuery
} from './validate-get-notifications-query.middleware';

const TZ1_A = 'tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A';
const TZ1_B = 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';

const createRes = () => {
  const res = {
    status: vi.fn(),
    send: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
};

describe('notificationsQuerySchema', () => {
  it('defaults missing query params for old clients', async () => {
    await expect(notificationsQuerySchema.validate({}, { stripUnknown: true })).resolves.toEqual({
      platform: PlatformType.Extension,
      startFromTime: 0,
      startID: 0,
      accountAddresses: []
    });
  });

  it('parses platform, cursor, repeated addresses, and comma-separated addresses', async () => {
    await expect(
      notificationsQuerySchema.validate(
        {
          platform: PlatformType.Mobile,
          startFromTime: '100',
          startID: '7',
          accountAddresses: [`${TZ1_A}, ${TZ1_B}`]
        },
        { stripUnknown: true }
      )
    ).resolves.toEqual({
      platform: PlatformType.Mobile,
      startFromTime: 100,
      startID: 7,
      accountAddresses: [TZ1_A, TZ1_B]
    });

    await expect(
      notificationsQuerySchema.validate({ accountAddresses: [TZ1_A, TZ1_B] }, { stripUnknown: true })
    ).resolves.toMatchObject({ accountAddresses: [TZ1_A, TZ1_B] });
  });

  it('rejects invalid, duplicate, and too many account addresses', async () => {
    await expect(notificationsQuerySchema.validate({ accountAddresses: 'not-an-address' })).rejects.toThrow(
      'Invalid account address'
    );
    await expect(notificationsQuerySchema.validate({ accountAddresses: [TZ1_A, TZ1_A] })).rejects.toThrow(
      'Account addresses must be unique'
    );
    await expect(
      notificationsQuerySchema.validate({
        accountAddresses: Array.from({ length: MAX_NOTIFICATION_ACCOUNT_ADDRESSES + 1 }, () =>
          b58cencode(randomBytes(20), prefix.tz1)
        )
      })
    ).rejects.toThrow(`No more than ${MAX_NOTIFICATION_ACCOUNT_ADDRESSES} account addresses are allowed`);
  });

  it('rejects a negative cursor', async () => {
    await expect(notificationsQuerySchema.validate({ startFromTime: '-1' })).rejects.toThrow();
    await expect(notificationsQuerySchema.validate({ startID: '1.5' })).rejects.toThrow();
  });
});

describe('validateGetNotificationsQuery', () => {
  it('attaches the parsed query and calls next', async () => {
    const req = { query: { platform: 'Mobile', accountAddresses: TZ1_A } } as unknown as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    await validateGetNotificationsQuery(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.notificationsQuery).toEqual({
      platform: PlatformType.Mobile,
      startFromTime: 0,
      startID: 0,
      accountAddresses: [TZ1_A]
    });
  });

  it('responds with 400 when the query is invalid', async () => {
    const req = { query: { accountAddresses: 'nope' } } as unknown as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    await validateGetNotificationsQuery(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      error: 'Invalid query params',
      details: ['Invalid account address']
    });
  });
});
