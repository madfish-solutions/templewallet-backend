require('./configure');

import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import firebaseAdmin from 'firebase-admin';
import { stdSerializers } from 'pino';
import pinoHttp from 'pino-http';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { getAdvertisingInfo } from './advertising/advertising';
import { MIN_ANDROID_APP_VERSION, MIN_IOS_APP_VERSION } from './config';
import getDAppsStats from './getDAppsStats';
import { getMagicSquareQuestParticipants, startMagicSquareQuest } from './magic-square';
import { basicAuth } from './middlewares/basic-auth.middleware';
import { Notification, PlatformType } from './notifications/notification.interface';
import { getImageFallback } from './notifications/utils/get-image-fallback.util';
import { getNotifications } from './notifications/utils/get-notifications.util';
import { getParsedContent } from './notifications/utils/get-parsed-content.util';
import { getPlatforms } from './notifications/utils/get-platforms.util';
import { redisClient } from './redis';
import { sliseRulesRouter } from './routers/slise-ad-rules';
import { getABData } from './utils/ab-test';
import { cancelAliceBobOrder } from './utils/alice-bob/cancel-alice-bob-order';
import { createAliceBobOrder } from './utils/alice-bob/create-alice-bob-order';
import { estimateAliceBobOutput } from './utils/alice-bob/estimate-alice-bob-output';
import { getAliceBobEstimationPayload } from './utils/alice-bob/get-alice-bob-estimation-payload';
import { getAliceBobOrderInfo } from './utils/alice-bob/get-alice-bob-order-info';
import { getAliceBobPairInfo } from './utils/alice-bob/get-alice-bob-pair-info';
import { getAliceBobPairsInfo } from './utils/alice-bob/get-alice-bob-pairs-info';
import { CodedError } from './utils/errors';
import { coinGeckoTokens } from './utils/gecko-tokens';
import { getExternalApiErrorPayload, isDefined, isNonEmptyString } from './utils/helpers';
import logger from './utils/logger';
import { getSignedMoonPayUrl } from './utils/moonpay/get-signed-moonpay-url';
import { getSigningNonce } from './utils/signing-nonce';
import SingleQueryDataProvider from './utils/SingleQueryDataProvider';
import { tezExchangeRateProvider } from './utils/tezos';
import { getExchangeRatesFromDB } from './utils/tokens';

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
app.use(bodyParser.json());

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

app.get('/api/notifications', async (_req, res) => {
  try {
    const { platform, startFromTime } = _req.query;
    const data = await getNotifications(
      redisClient,
      platform === PlatformType.Mobile ? PlatformType.Mobile : PlatformType.Extension,
      Number(startFromTime) ?? 0
    );

    res.status(200).send(data);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.post('/api/notifications', basicAuth, async (req, res) => {
  try {
    const {
      mobile,
      extension,
      type,
      title,
      description,
      extensionImageUrl,
      mobileImageUrl,
      content,
      date,
      expirationDate,
      isMandatory
    } = req.body;

    const newNotification: Notification = {
      id: Date.now(),
      createdAt: date,
      type,
      platforms: getPlatforms(mobile, extension),
      language: 'en-US',
      title,
      description,
      content: getParsedContent(content),
      extensionImageUrl: isNonEmptyString(extensionImageUrl)
        ? extensionImageUrl
        : getImageFallback(PlatformType.Extension, type),
      mobileImageUrl: isNonEmptyString(mobileImageUrl) ? mobileImageUrl : getImageFallback(PlatformType.Mobile, type),
      expirationDate,
      isMandatory: isDefined(isMandatory)
    };

    await redisClient.lpush('notifications', JSON.stringify(newNotification));

    res.status(200).send({ message: 'Notification added successfully', notification: newNotification });
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

app.get('/api/dapps', makeProviderDataRequestHandler(dAppsProvider));

app.get('/api/abtest', (_, res) => {
  const data = getABData();
  res.json(data);
});

app.get('/api/exchange-rates/tez', makeProviderDataRequestHandler(tezExchangeRateProvider));

app.get('/api/exchange-rates', async (_req, res) => {
  const tokensExchangeRates = await getExchangeRatesFromDB();
  const { data: tezExchangeRate, error: tezExchangeRateError } = await getProviderStateWithTimeout(
    tezExchangeRateProvider
  );

  if (tezExchangeRateError !== undefined) {
    return res.status(500).send({
      error: tezExchangeRateError.message
    });
  }

  res.json([...tokensExchangeRates, { exchangeRate: tezExchangeRate.toString() }]);
});

app.get('/api/moonpay-sign', async (_req, res) => {
  try {
    const url = _req.query.url;

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

app.get('/api/alice-bob/get-pairs-info', async (_req, res) => {
  const { isWithdraw } = _req.query;

  try {
    const pairsInfo = await getAliceBobPairsInfo(isWithdraw === 'true');

    res.status(200).send({ pairsInfo });
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
  const { isWithdraw, amount, from, to } = _req.query;

  try {
    const payload = getAliceBobEstimationPayload(isWithdraw, from, to, amount);

    const outputAmount = await estimateAliceBobOutput(payload);

    res.status(200).send({ outputAmount });
  } catch (error) {
    const { status, data } = getExternalApiErrorPayload(error);
    res.status(status).send({ error: data });
  }
});

app.get('/api/mobile-check', async (_req, res) => {
  const platform = _req.query.platform;
  const appCheckToken = _req.query.appCheckToken;

  if (!Boolean(appCheckToken) || appCheckToken === undefined) {
    return res.status(400).send({ error: 'App Check token is not defined' });
  }

  try {
    if (platform === 'ios') {
      await iosApp.appCheck().verifyToken(appCheckToken as unknown as string);
    } else {
      await androidApp.appCheck().verifyToken(appCheckToken as unknown as string);
    }

    res.status(200).send({
      minIosVersion: MIN_IOS_APP_VERSION,
      minAndroidVersion: MIN_ANDROID_APP_VERSION,
      isAppCheckFailed: false
    });
  } catch (err) {
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

app.use('/api/slise-ad-rules', sliseRulesRouter);

app.post('/api/magic-square-quest/start', async (req, res) => {
  try {
    await startMagicSquareQuest(req.body);

    res.status(200).send({ message: 'Quest successfully started' });
  } catch (error: any) {
    console.error(error);

    if (error instanceof CodedError) {
      res.status(error.code).send(error.buildResponse());
    } else {
      res.status(500).send({ message: error?.message });
    }
  }
});

app.get('/api/magic-square-quest/participants', basicAuth, async (req, res) => {
  try {
    res.status(200).send(await getMagicSquareQuestParticipants());
  } catch (error: any) {
    console.error(error);

    if (error instanceof CodedError) {
      res.status(error.code).send(error.buildResponse());
    } else {
      res.status(500).send({ message: error?.message });
    }
  }
});

app.get('/api/signing-nonce', (req, res) => {
  try {
    const pkh = req.query.pkh;
    if (!pkh || typeof pkh !== 'string') throw new Error('PKH is not a string');

    res.status(200).send(getSigningNonce(pkh));
  } catch (error: any) {
    console.error(error);

    if (error instanceof CodedError) {
      res.status(error.code).send(error.buildResponse());
    } else {
      res.status(500).send({ message: error?.message });
    }
  }
});

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Temple Wallet backend',
      version: '1.0.0'
    }
  },
  apis: ['./src/index.ts', './src/routers/**/*.ts']
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// start the server listening for requests
const port = Boolean(process.env.PORT) ? process.env.PORT : 3000;
app.listen(port, () => console.info(`Server is running on port ${port}...`));
