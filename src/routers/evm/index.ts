import axios, { AxiosError } from 'axios';
import { Router } from 'express';

import { EnvVars } from '../../config';

const evmApi = axios.create({ baseURL: EnvVars.EVM_API_URL });

export const evmRouter = Router();

evmRouter.use(async (req, res, next) => {
  if (req.method.toLowerCase() !== 'get') {
    next();

    return;
  }

  try {
    const response = await evmApi.get(`/api${req.path}`, {
      params: req.query,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .map(([key, value]): [string, string | undefined] => [key, Array.isArray(value) ? value.join(',') : value])
          .filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });

    res
      .setHeaders(new Map(Object.entries(response.headers)))
      .status(response.status)
      .send(response.data);
  } catch (e) {
    if (e instanceof AxiosError && e.response) {
      const response = e.response;
      res
        .setHeaders(new Map(Object.entries(response.headers)))
        .status(response.status)
        .send(response.data);

      return;
    }

    res.status(500).json({ error: 'Could not get response' });
  }
});
