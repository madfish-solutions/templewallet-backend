require('./configure');

import { EvmChain } from '@moralisweb3/common-evm-utils';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import firebaseAdmin from 'firebase-admin';
import Moralis from 'moralis';
import { stdSerializers } from 'pino';
import pinoHttp from 'pino-http';
import { isString } from 'util';

import { getAdvertisingInfo } from './advertising/advertising';
import { MIN_ANDROID_APP_VERSION, MIN_IOS_APP_VERSION, EnvVars } from './config';
import getDAppsStats from './getDAppsStats';
// import { basicAuth } from './middlewares/basic-auth.middleware';
// import { Notification, PlatformType } from './notifications/notification.interface';
// import { getImageFallback } from './notifications/utils/get-image-fallback.util';
// import { getNotifications } from './notifications/utils/get-notifications.util';
// import { getParsedContent } from './notifications/utils/get-parsed-content.util';
// import { getPlatforms } from './notifications/utils/get-platforms.util';
// import { redisClient } from './redis';
import { getABData } from './utils/ab-test';
import { cancelAliceBobOrder } from './utils/alice-bob/cancel-alice-bob-order';
import { createAliceBobOrder } from './utils/alice-bob/create-alice-bob-order';
import { estimateAliceBobOutput } from './utils/alice-bob/estimate-alice-bob-output';
import { getAliceBobEstimationPayload } from './utils/alice-bob/get-alice-bob-estimation-payload';
import { getAliceBobOrderInfo } from './utils/alice-bob/get-alice-bob-order-info';
import { getAliceBobPairInfo } from './utils/alice-bob/get-alice-bob-pair-info';
import { getAliceBobPairsInfo } from './utils/alice-bob/get-alice-bob-pairs-info';
import { coinGeckoTokens } from './utils/gecko-tokens';
import { getExternalApiErrorPayload, isDefined } from './utils/helpers';
import logger from './utils/logger';
import { getSignedMoonPayUrl } from './utils/moonpay/get-signed-moonpay-url';
import SingleQueryDataProvider from './utils/SingleQueryDataProvider';
//import { tezExchangeRateProvider } from './utils/tezos';
//import { tokensExchangeRatesProvider } from './utils/tokens';

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

// app.get('/api/notifications', async (_req, res) => {
//   try {
//     const { platform, startFromTime } = _req.query;
//     const data = await getNotifications(
//       redisClient,
//       platform === PlatformType.Mobile ? PlatformType.Mobile : PlatformType.Extension,
//       Number(startFromTime) ?? 0
//     );
//
//     res.status(200).send(data);
//   } catch (error) {
//     res.status(500).send({ error });
//   }
// });

// app.post('/api/notifications', basicAuth, async (req, res) => {
//   try {
//     const {
//       mobile,
//       extension,
//       type,
//       title,
//       description,
//       extensionImageUrl,
//       mobileImageUrl,
//       content,
//       date,
//       expirationDate,
//       isMandatory
//     } = req.body;
//
//     const newNotification: Notification = {
//       id: Date.now(),
//       createdAt: date,
//       type,
//       platforms: getPlatforms(mobile, extension),
//       language: 'en-US',
//       title,
//       description,
//       content: getParsedContent(content),
//       extensionImageUrl: isNonEmptyString(extensionImageUrl)
//         ? extensionImageUrl
//         : getImageFallback(PlatformType.Extension, type),
//       mobileImageUrl: isNonEmptyString(mobileImageUrl) ? mobileImageUrl : getImageFallback(PlatformType.Mobile, type),
//       expirationDate,
//       isMandatory: isDefined(isMandatory)
//     };
//
//     await redisClient.lpush('notifications', JSON.stringify(newNotification));
//
//     res.status(200).send({ message: 'Notification added successfully' });
//   } catch (error: any) {
//     res.status(500).send({ error: error.message });
//   }
// });

app.get('/api/dapps', makeProviderDataRequestHandler(dAppsProvider));

app.get('/api/abtest', (_, res) => {
  const data = getABData();
  res.json(data);
});

//app.get('/api/exchange-rates/tez', makeProviderDataRequestHandler(tezExchangeRateProvider));

// app.get('/api/exchange-rates', async (_req, res) => {
//   const { data: tokensExchangeRates, error: tokensExchangeRatesError } = await getProviderStateWithTimeout(
//     tokensExchangeRatesProvider
//   );
//   const { data: tezExchangeRate, error: tezExchangeRateError } = await getProviderStateWithTimeout(
//     tezExchangeRateProvider
//   );
//   if (tokensExchangeRatesError !== undefined) {
//     return res.status(500).send({
//       error: tokensExchangeRatesError.message
//     });
//   } else if (tezExchangeRateError !== undefined) {
//     return res.status(500).send({
//       error: tezExchangeRateError.message
//     });
//   } else {
//     if (tokensExchangeRates !== undefined && tezExchangeRate !== undefined) {
//       return res.json([
//         ...tokensExchangeRates.map(({ ...restProps }) => restProps),
//         { exchangeRate: tezExchangeRate.toString() }
//       ]);
//     }
//   }
// });

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

app.get('/api/bitcoin', async (_req, res) => {
  const { addresses: addressesConcat } = _req.query;
  console.log(addressesConcat);

  if (!isString(addressesConcat)) {
    throw new Error('Addresses is not a string');
  }

  try {
    const addresses = addressesConcat.split(';');

    const utxoPromises = addresses.map(async address => {
      try {
        const response = await axios.get(`https://blockstream.info/testnet/api/address/${address}/utxo`);

        return { address, utxos: response.data };
      } catch (error: any) {
        console.error(`Error fetching utxos for ${address}: ${error.message}`);

        return { address, utxos: [] };
      }
    });

    const utxos = await Promise.all(utxoPromises);

    const allUtxos = utxos.flatMap(({ utxos }) => utxos);

    const totalAmountAvailable: number = allUtxos.reduce((acc, utxo) => (acc += utxo.value), 0);

    const bitcoin = {
      token_address: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
      logo: 'https://cdn.moralis.io/eth/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
      thumbnail: 'https://cdn.moralis.io/eth/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599_thumb.png',
      decimals: 8,
      balance: totalAmountAvailable.toFixed(),
      chainName: 'Bitcoin Testnet',
      nativeToken: true,
      possible_spam: false
    };

    res.status(200).send(bitcoin);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.get('/api/bitcoin-utxos', async (_req, res) => {
  const { addresses: addressesConcat } = _req.query;
  console.log(addressesConcat);

  if (!isString(addressesConcat)) {
    throw new Error('Addresses is not a string');
  }

  try {
    const addresses = addressesConcat.split(';');

    const utxoPromises = addresses.map(async address => {
      try {
        const response = await axios.get(`https://blockstream.info/testnet/api/address/${address}/utxo`);

        return { address, utxos: response.data };
      } catch (error: any) {
        console.error(`Error fetching utxos for ${address}: ${error.message}`);

        return { address, utxos: [] };
      }
    });

    const utxos = await Promise.all(utxoPromises);

    res.status(200).send(utxos);
  } catch (error) {
    res.status(500).send({ error });
  }
});

app.post('/api/bitcoin-broadcast-tx', async (_req, res) => {
  const { txHex } = _req.query;
  console.log(txHex);

  if (!isString(txHex)) {
    throw new Error('txHex is not a string');
  }

  try {
    const { data } = await axios.post('https://api.blockcypher.com/v1/btc/test3/txs/push', {
      tx: txHex
    });

    console.log('Transaction broadcast successful:', data);

    res.status(200).send(data);
  } catch (error: any) {
    if (Boolean(error.response)) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Transaction broadcast failed with status code:', error.response.status);
      console.error('Error data:', error.response.data);
    } else if (Boolean(error.request)) {
      // The request was made but no response was received
      console.error('No response received from the server:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up the request:', error.message);
      res.status(500).send({ error: error.response.data });
    }
  }
});

app.get('/api/evm-tokens', async (_req, res) => {
  const { address } = _req.query;

  const tokens = [
    {
      token_address: 'eth',
      symbol: 'ETH',
      name: 'Ether',
      logo: 'https://cdn.moralis.io/eth/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png',
      thumbnail: 'https://cdn.moralis.io/eth/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee_thumb.png',
      decimals: 18,
      balance: '0',
      chainName: 'Ethereum Sepolia',
      nativeToken: true,
      possible_spam: false
    },
    {
      token_address: 'matic',
      symbol: 'MATIC',
      name: 'Matic',
      logo: 'https://cdn.moralis.io/eth/0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0.png',
      thumbnail: 'https://cdn.moralis.io/eth/0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0_thumb.png',
      decimals: 18,
      balance: '0',
      chainName: 'Polygon Mumbai',
      nativeToken: true,
      possible_spam: false
    },
    {
      token_address: 'bnb',
      symbol: 'BNB',
      name: 'BNB',
      logo: 'https://cdn.moralis.io/eth/0x4fabb145d64652a948d72533023f6e7a623c7c53.png',
      thumbnail: 'https://cdn.moralis.io/eth/0x4fabb145d64652a948d72533023f6e7a623c7c53_thumb.png',
      decimals: 18,
      balance: '0',
      chainName: 'BSC Testnet',
      nativeToken: true,
      possible_spam: false
    }
  ];

  try {
    const ethBalanceResponse = await Moralis.EvmApi.balance.getNativeBalance({
      address: address as string,
      chain: EvmChain.SEPOLIA
    });

    const maticBalanceResponse = await Moralis.EvmApi.balance.getNativeBalance({
      address: address as string,
      chain: EvmChain.MUMBAI
    });

    const bnbBalanceResponse = await Moralis.EvmApi.balance.getNativeBalance({
      address: address as string,
      chain: EvmChain.BSC_TESTNET
    });

    tokens[0].balance = ethBalanceResponse.raw.balance;
    tokens[1].balance = maticBalanceResponse.raw.balance;
    tokens[2].balance = bnbBalanceResponse.raw.balance;

    const tokensWithBalances1 = await Moralis.EvmApi.token.getWalletTokenBalances({
      address: address as string,
      chain: EvmChain.SEPOLIA
    });
    const tokensWithBalances2 = await Moralis.EvmApi.token.getWalletTokenBalances({
      address: address as string,
      chain: EvmChain.BSC_TESTNET
    });

    const tokensWithBalances = tokensWithBalances1.raw
      .map(token => ({ ...token, chainName: 'Ethereum Sepolia' }))
      .concat(tokensWithBalances2.raw.map(token => ({ ...token, chainName: 'BSC Testnet' })));

    //testnet tokens does not have logos
    const mainnetTokensMetadataResponse = await Moralis.EvmApi.token.getTokenMetadata({
      addresses: [
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        '0x4fabb145d64652a948d72533023f6e7a623c7c53',
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
      ],
      chain: EvmChain.ETHEREUM
    });

    const logos = mainnetTokensMetadataResponse.raw.reduce((acc, metadata) => {
      if (metadata.symbol === 'WBTC') {
        acc['BTCB'] = { logo: metadata.logo, thumb: metadata.thumbnail };

        return acc;
      }

      acc[metadata.symbol] = { logo: metadata.logo, thumb: metadata.thumbnail };

      return acc;
    }, {});

    const tokensWithBalancesAndLogos = tokensWithBalances.map(token => ({
      ...token,
      logo: isDefined(logos[token.symbol]) ? logos[token.symbol].logo : '',
      thumbnail: isDefined(logos[token.symbol]) ? logos[token.symbol].thumb : '',
      name: token.symbol === 'BTCB' ? 'Binance-Peg BTCB Token' : token.name,
      nativeToken: false
    }));

    tokens.push(...tokensWithBalancesAndLogos);

    res.status(200).send(tokens);
  } catch (error) {
    res.status(500).send({ error });
  }
});

// start the server listening for requests
const port = Boolean(process.env.PORT) ? process.env.PORT : 3000;

const startServer = async () => {
  await Moralis.start({
    apiKey: EnvVars.MORALIS_API_KEY
  });

  app.listen(port, () => console.info(`Server is running on port ${port}...`));
};

startServer();
