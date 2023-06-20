require('./configure');

import cors from 'cors';
import express, { Request, Response } from 'express';
import firebaseAdmin from 'firebase-admin';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { stdSerializers } from 'pino';
import pinoHttp from 'pino-http';

import { getAdvertisingInfo } from './advertising/advertising';
import { MIN_ANDROID_APP_VERSION, MIN_IOS_APP_VERSION } from './config';
import getDAppsStats from './getDAppsStats';
import { DbData } from './interfaces/db-data.interface';
import { PlatformType } from './notifications/notification.interface';
import { getNotifications } from './notifications/notifications.utils';
import { getABData } from './utils/ab-test';
import { cancelAliceBobOrder } from './utils/alice-bob/cancel-alice-bob-order';
import { createAliceBobOrder } from './utils/alice-bob/create-alice-bob-order';
import { estimateAliceBobOutput } from './utils/alice-bob/estimate-alice-bob-output';
import { getAliceBobOrderInfo } from './utils/alice-bob/get-alice-bob-order-info';
import { getAliceBobPairInfo } from './utils/alice-bob/get-alice-bob-pair-info';
import { coinGeckoTokens } from './utils/gecko-tokens';
import { getExternalApiErrorPayload } from './utils/helpers';
import logger from './utils/logger';
import { getSignedMoonPayUrl } from './utils/moonpay/get-signed-moonpay-url';
import SingleQueryDataProvider from './utils/SingleQueryDataProvider';
import { tezExchangeRateProvider } from './utils/tezos';
import { tokensExchangeRatesProvider } from './utils/tokens';

const PINO_LOGGER = {
  logger: logger.child({ name: 'web' }),
  serializers: {
    req: req => ({
      method: req.method,
      url: req.url,
      body: req.body,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
      id: req.id
    }),
    err: err => {
      const { type, message } = stdSerializers.err(err);

      return { type, message };
    },
    res: res => ({
      statusCode: res.statusCode
    })
  }
};

const app = express();
app.use(pinoHttp(PINO_LOGGER));
app.use(cors());

const adapter = new FileSync<DbData>('db.json');
const db = low(adapter);

const defaultData: DbData = { notifications: [] };
db.defaults(defaultData).write();

const dAppsProvider = new SingleQueryDataProvider(15 * 60 * 1000, getDAppsStats);

const androidApp = firebaseAdmin.initializeApp(
  {
    projectId: 'templewallet-fa3b3'
  },
  'androidApp'
);
const iosApp = firebaseAdmin.initializeApp(
  {
    projectId: 'templewallet-fa3b3'
  },
  'iosApp'
);

const getProviderStateWithTimeout = <T>(provider: SingleQueryDataProvider<T>) =>
  Promise.race([
    provider.getState(),
    new Promise<{ data?: undefined; error: Error }>(resolve =>
      setTimeout(() => resolve({ error: new Error('Response timed out') }), 30000)
    )
  ]);

const makeProviderDataRequestHandler = <T, U>(provider: SingleQueryDataProvider<T>, transformFn?: (data: T) => U) => {
  return async (_req: Request, res: Response) => {
    const { data, error } = await getProviderStateWithTimeout(provider);
    if (error) {
      res.status(500).send({ error: error.message });
    } else {
      if (data !== undefined) {
        res.json(transformFn ? transformFn(data) : data);
      }
    }
  };
};

app.get('/api/top-coins', (_req, res) => {
  res.status(200).send(coinGeckoTokens);
});

app.get('/api/notifications', (_req, res) => {
  try {
    const { platform, startFromTime } = _req.query;
    const data = getNotifications(
      db,
      platform === PlatformType.Mobile ? PlatformType.Mobile : PlatformType.Extension,
      Number(startFromTime) ?? 0
    );

    res.status(200).send(data);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.get('/api/dapps', makeProviderDataRequestHandler(dAppsProvider));

app.get('/api/abtest', (_, res) => {
  const data = getABData();
  res.json(data);
});

app.get('/api/exchange-rates/tez', makeProviderDataRequestHandler(tezExchangeRateProvider));

app.get('/api/exchange-rates', async (_req, res) => {
  const { data: tokensExchangeRates, error: tokensExchangeRatesError } = await getProviderStateWithTimeout(
    tokensExchangeRatesProvider
  );
  const { data: tezExchangeRate, error: tezExchangeRateError } = await getProviderStateWithTimeout(
    tezExchangeRateProvider
  );
  if (tokensExchangeRatesError !== undefined) {
    return res.status(500).send({
      error: tokensExchangeRatesError.message
    });
  } else if (tezExchangeRateError !== undefined) {
    return res.status(500).send({
      error: tezExchangeRateError.message
    });
  } else {
    if (tokensExchangeRates !== undefined && tezExchangeRate !== undefined) {
      return res.json([
        ...tokensExchangeRates.map(({ ...restProps }) => restProps),
        { exchangeRate: tezExchangeRate.toString() }
      ]);
    }
  }
});

app.get('/api/moonpay-sign', async (_req, res) => {
  try {
    const url = _req.query.url;
    console.log('url: ', url);
    console.log('url: type', typeof url);

    if (typeof url === 'string') {
      const signedUrl = getSignedMoonPayUrl(url);

      return res.status(200).send({ signedUrl });
    }

    res.status(500).send({ error: 'Requested URL is not valid' });
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.post('/api/alice-bob/create-order', async (_req, res) => {
  const { isWithdraw, amount, userId, walletAddress, cardNumber } = _req.query;
  const booleanIsWithdraw = isWithdraw === 'true';

  try {
    const exchangeInfo = {
      from: booleanIsWithdraw ? 'TEZ' : 'CARDUAH',
      to: booleanIsWithdraw ? 'CARDUAH' : 'TEZ',
      fromAmount: Number(amount),
      userId: String(userId),
      toPaymentDetails: booleanIsWithdraw ? String(cardNumber) : String(walletAddress),
      redirectUrl: 'https://templewallet.com/mobile'
    };

    const orderInfo = await createAliceBobOrder(booleanIsWithdraw, exchangeInfo);

    res.status(200).send({ orderInfo });
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send(data);
  }
});

app.post('/api/alice-bob/cancel-order', async (_req, res) => {
  const { orderId } = _req.query;

  try {
    await cancelAliceBobOrder({ id: String(orderId) });

    res.status(200);
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send(data);
  }
});

app.get('/api/alice-bob/get-pair-info', async (_req, res) => {
  const { isWithdraw } = _req.query;

  try {
    const pairInfo = await getAliceBobPairInfo(isWithdraw === 'true');

    res.status(200).send({ pairInfo });
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send(data);
  }
});

app.get('/api/alice-bob/check-order', async (_req, res) => {
  const { orderId } = _req.query;

  try {
    const orderInfo = await getAliceBobOrderInfo(String(orderId));

    res.status(200).send({ orderInfo });
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send({ error: data });
  }
});

app.post('/api/alice-bob/estimate-amount', async (_req, res) => {
  const { isWithdraw, amount } = _req.query;
  const booleanIsWithdraw = isWithdraw === 'true';

  try {
    const exchangeInfo = {
      from: booleanIsWithdraw ? 'TEZ' : 'CARDUAH',
      to: booleanIsWithdraw ? 'CARDUAH' : 'TEZ',
      fromAmount: Number(amount)
    };
    const outputAmount = await estimateAliceBobOutput(exchangeInfo);

    res.status(200).send({ outputAmount });
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send({ error: data });
  }
});

app.get('/api/mobile-check', async (_req, res) => {
  console.log(1);
  console.log('androidAppId', process.env.ANDROID_APP_ID);
  console.log('iosAppId', process.env.IOS_APP_ID);

  const platform = _req.query.platform;
  const appCheckToken = _req.query.appCheckToken;
  console.log('token', appCheckToken);

  console.log(1);
  console.log('androidAppId', process.env.ANDROID_APP_ID);
  console.log('iosAppId', process.env.IOS_APP_ID);

  console.log('A123', platform, appCheckToken);

  if (!Boolean(appCheckToken) || appCheckToken === undefined) {
    return res.status(400).send({ error: 'App Check token is not defined' });
  }

  try {
    if (platform === 'ios') {
      await iosApp.appCheck().verifyToken(appCheckToken as unknown as string);
    } else {
      await androidApp.appCheck().verifyToken(appCheckToken as unknown as string);
      console.log('verification successful');
    }

    res.status(200).send({
      minIosVersion: MIN_IOS_APP_VERSION,
      minAndroidVersion: MIN_ANDROID_APP_VERSION,
      isAppCheckFailed: false
    });
  } catch (err) {
    console.log('err', err);
    res.status(200).send({
      minIosVersion: MIN_IOS_APP_VERSION,
      minAndroidVersion: MIN_ANDROID_APP_VERSION,
      isAppCheckFailed: process.env.SHOULD_APP_CHECK_BLOCK_THE_APP === 'true' // this flag is intentionally false for development
    });
  }
});

app.get('/api/advertising-info', (_req, res) => {
  try {
    const data = getAdvertisingInfo();

    res.status(200).send({ data });
  } catch (error) {
    res.status(500).send({ error });
  }
});

// start the server listening for requests
const port = Boolean(process.env.PORT) ? process.env.PORT : 3000;
app.listen(port, () => console.info(`Server is running on port ${port}...`));
