import axios, { AxiosRequestHeaders, AxiosResponse, AxiosResponseHeaders } from 'axios';
import { Router } from 'express';
import { IncomingHttpHeaders } from 'http';

import { EnvVars } from '../config';

export const googleDriveRouter = Router();

const googleDriveApi = axios.create({
  baseURL: 'https://www.googleapis.com'
});

const allowedBodyMethods = ['post', 'patch', 'delete'] as const;
const isAllowedBodyMethod = (method: string): method is (typeof allowedBodyMethods)[number] =>
  allowedBodyMethods.includes(method as (typeof allowedBodyMethods)[number]);

const toAxiosRequestHeaders = (headers: IncomingHttpHeaders): AxiosRequestHeaders => {
  const axiosHeaders: AxiosRequestHeaders = {};
  for (const key in headers) {
    if (key !== 'host') {
      const value = headers[key];
      if (value === undefined) continue;

      axiosHeaders[key] = typeof value === 'string' ? value : value.join(', ');
    }
  }

  return axiosHeaders;
};

const fromAxiosResponseHeaders = (headers: AxiosResponseHeaders): Headers => {
  const responseHeaders = new Headers();
  for (const key in headers) {
    responseHeaders.append(key, headers[key]);
  }

  return responseHeaders;
};

googleDriveRouter.use(async (req, res) => {
  const methodName = req.method.toLowerCase();
  try {
    const commonRequestConfig = {
      params: {
        ...req.query,
        key: req.url.startsWith('/oauth2') ? undefined : EnvVars.GOOGLE_DRIVE_API_KEY
      },
      headers: {
        ...toAxiosRequestHeaders(req.headers),
        'Content-Type': 'application/json'
      }
    };

    let response: AxiosResponse;
    if (methodName === 'get') {
      response = await googleDriveApi.get(req.url, commonRequestConfig);
    } else if (isAllowedBodyMethod(methodName)) {
      response = await googleDriveApi[methodName](req.url, req.body, commonRequestConfig);
    } else {
      throw new Error('Method Not Allowed');
    }

    res.status(response.status).setHeaders(fromAxiosResponseHeaders(response.headers)).send(response.data);
  } catch (error) {
    if (methodName !== 'get' && !isAllowedBodyMethod(methodName)) {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (axios.isAxiosError(error) && error.response) {
      res
        .status(error.response.status)
        .setHeaders(fromAxiosResponseHeaders(error.response.headers))
        .send(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});
