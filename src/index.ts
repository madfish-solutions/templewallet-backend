import {MIN_ANDROID_APP_VERSION, MIN_IOS_APP_VERSION} from "./config";
require("./configure");

import cors from "cors";
import express, { Request, Response } from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import getDAppsStats from "./getDAppsStats";
import { tezExchangeRateProvider } from "./utils/tezos";
import { tokensExchangeRatesProvider } from "./utils/tokens";
import logger from "./utils/logger";
import SingleQueryDataProvider from "./utils/SingleQueryDataProvider";
import {getSignedMoonPayUrl} from "./utils/get-signed-moonpay-url";
import { getABData } from "./utils/ab-test";

const PINO_LOGGER = {
  logger: logger.child({ name: "web" }),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      body: req.body,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
      id: req.id,
    }),
    err: (err) => {
      const { type, message } = pino.stdSerializers.err(err);
      return { type, message };
    },
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
};

const app = express();
app.use(pinoHttp(PINO_LOGGER));
app.use(cors());

const dAppsProvider = new SingleQueryDataProvider(
  15 * 60 * 1000,
  getDAppsStats
);

const firebaseAdmin = require('firebase-admin');
const androidApp = firebaseAdmin.initializeApp({
  projectId: 'templewallet-fa3b3',
  appId: process.env.ANDROID_APP_ID!
}, 'androidApp');
const iosApp = firebaseAdmin.initializeApp({
  projectId: 'templewallet-fa3b3',
  appId: process.env.IOS_APP_ID!
}, 'iosApp');

const getProviderStateWithTimeout = <T>(provider: SingleQueryDataProvider<T>) =>
  Promise.race([
    provider.getState(),
    new Promise<{ data?: undefined; error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ error: new Error("Response timed out") }),
        30000
      )
    ),
  ]);

const makeProviderDataRequestHandler = <T, U>(
  provider: SingleQueryDataProvider<T>,
  transformFn?: (data: T) => U
) => {
  return async (_req: Request, res: Response) => {
    const { data, error } = await getProviderStateWithTimeout(provider);
    if (error) {
      res.status(500).send({ error: error.message });
    } else {
      res.json(transformFn ? transformFn(data!) : data);
    }
  };
};

app.get("/api/dapps", makeProviderDataRequestHandler(dAppsProvider));

app.get("/api/abtest", (_, res) => {
  const data = getABData();
  res.json(data);
});

app.get(
  "/api/exchange-rates/tez",
  makeProviderDataRequestHandler(tezExchangeRateProvider)
);

app.get("/api/exchange-rates", async (_req, res) => {
  const { data: tokensExchangeRates, error: tokensExchangeRatesError } =
    await getProviderStateWithTimeout(tokensExchangeRatesProvider);
  const { data: tezExchangeRate, error: tezExchangeRateError } =
    await getProviderStateWithTimeout(tezExchangeRateProvider);
  if (tokensExchangeRatesError || tezExchangeRateError) {
    res.status(500).send({
      error: (tokensExchangeRatesError || tezExchangeRateError)!.message,
    });
  } else {
    res.json([
      ...tokensExchangeRates!.map(({ metadata, ...restProps }) => restProps),
      { exchangeRate: tezExchangeRate!.toString() },
    ]);
  }
});

app.get(
  "/api/moonpay-sign",
  async (_req, res) => {
    try {
      const url = _req.query.url;

      if (typeof(url) === 'string') {
        const signedUrl = getSignedMoonPayUrl(url);
        res.status(200).send({ signedUrl });
      }

      res.status(500).send({ error: 'Requested URL is not valid' });
    } catch (error) {
      res.status(500).send({ error });
    }
  });

app.get('/api/mobile-check', async (_req, res) => {
  console.log(1);
  console.log("androidAppId", process.env.ANDROID_APP_ID);
  console.log("iosAppId", process.env.IOS_APP_ID);

  const platform = _req.query.platform;
  const appCheckToken = _req.query.appCheckToken;
  console.log("token", appCheckToken);

  console.log(1);
  console.log("androidAppId", process.env.ANDROID_APP_ID);
  console.log("iosAppId", process.env.IOS_APP_ID);

  console.log('A123', platform, appCheckToken);

  if (!appCheckToken) {
    res.status(400).send({ error: 'App Check token is not defined' });
  }

  try {
    if (platform === 'ios') {
      await iosApp.appCheck().verifyToken(appCheckToken);
    } else {
      await androidApp.appCheck().verifyToken(appCheckToken);
      console.log("verification successful");
    }

    res.status(200).send({
      minIosVersion: MIN_IOS_APP_VERSION,
      minAndroidVersion: MIN_ANDROID_APP_VERSION,
      isAppCheckFailed: false
    });
  } catch (err) {
    console.log("err", err);
    res.status(200).send({
      minIosVersion: MIN_IOS_APP_VERSION,
      minAndroidVersion: MIN_ANDROID_APP_VERSION,
      isAppCheckFailed: process.env.SHOULD_APP_CHECK_BLOCK_THE_APP === 'true' // this flag is intentionally false for development
    });
  }
});

// start the server listening for requests
app.listen(process.env.PORT || 3000, () => console.log("Server is running..."));
