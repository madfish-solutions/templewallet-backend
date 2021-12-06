require("./configure");

import cors from "cors";
import express, { Request, Response } from "express";
import getDAppsStats from "./getDAppsStats";
import {
  isKnownNetwork,
  KNOWN_NETWORKS,
  tezExchangeRateProvider,
} from "./utils/tezos";
import { tokensExchangeRatesProvider } from "./utils/tokens";
import SingleQueryDataProvider from "./utils/SingleQueryDataProvider";
import { poolsDataProvider } from "./utils/pools";
import DataProvider from "./utils/DataProvider";

const app = express();
app.use(cors());

const dAppsProvider = new SingleQueryDataProvider(
  15 * 60 * 1000,
  getDAppsStats
);

const getSingleQueryProviderStateWithTimeout = <T>(
  provider: SingleQueryDataProvider<T>
) =>
  Promise.race([
    provider.getState(),
    new Promise<{ data?: undefined; error: Error }>((resolve) =>
      setTimeout(
        () => resolve({ error: new Error("Response timed out") }),
        30000
      )
    ),
  ]);

const getDataProviderStateWithTimeout = <T, A extends any[]>(
  provider: DataProvider<T, A>,
  ...args: A
) =>
  Promise.race([
    provider.get(...args),
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
    const { data, error } = await getSingleQueryProviderStateWithTimeout(
      provider
    );
    if (error) {
      res.status(500).send({ error: error.message });
    } else {
      res.json(transformFn ? transformFn(data!) : data);
    }
  };
};

app.get("/api/dapps", makeProviderDataRequestHandler(dAppsProvider));

app.get(
  "/api/exchange-rates/tez",
  makeProviderDataRequestHandler(tezExchangeRateProvider)
);

app.get("/api/exchange-rates", async (_req, res) => {
  const { data: tokensExchangeRates, error: tokensExchangeRatesError } =
    await getSingleQueryProviderStateWithTimeout(tokensExchangeRatesProvider);
  const { data: tezExchangeRate, error: tezExchangeRateError } =
    await getSingleQueryProviderStateWithTimeout(tezExchangeRateProvider);
  if (tokensExchangeRatesError || tezExchangeRateError) {
    res.status(500).send({
      error: (tokensExchangeRatesError || tezExchangeRateError)!.message,
    });
  } else {
    res.json([
      ...tokensExchangeRates!.map(({ metadata, tokenId, ...restProps }) => ({
        ...restProps,
        tokenId: tokenId === undefined ? undefined : +tokenId,
      })),
      { exchangeRate: tezExchangeRate!.toString() },
    ]);
  }
});

app.get("/api/:network/pools", async (req, res) => {
  const { network } = req.params;
  if (!isKnownNetwork(network)) {
    res.status(401).send({
      error: `Only these networks are supported: ${KNOWN_NETWORKS.join(", ")}`,
    });
    return;
  }
  const { data: poolsData, error: poolsError } =
    await getDataProviderStateWithTimeout(poolsDataProvider, network);
  if (poolsError) {
    res.status(500).send({
      error: poolsError.message,
    });
  } else {
    res.json(poolsData);
  }
});

// start the server listening for requests
app.listen(process.env.PORT || 3000, () => console.log("Server is running..."));
