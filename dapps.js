const cors = require("cors");
const express = require("express");
const pinoHttp = require("pino-http");
const getDAppsStats = require("./getDAppsStats");
const logger = require("./utils/logger");
const SingleQueryDataProvider = require("./utils/SingleQueryDataProvider");

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

app.get("/api/dapps", async function (_req, res) {
  const { data, error } = await dAppsProvider.getState();
  if (error) {
    res.status(500).send({ error: error.message });
  } else {
    res.json(data);
  }
});

// start the server listening for requests
app.listen(process.env.PORT || 3000, () => console.log("Server is running..."));
