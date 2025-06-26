import axios, { AxiosRequestHeaders, AxiosResponse } from 'axios';
import { Router } from 'express';
import { IncomingHttpHeaders } from 'http';
import { omit } from 'lodash';
import { object as objectSchema, mixed as mixedSchema, string as stringSchema } from 'yup';

import { EnvVars } from '../config';
import { isDefined } from '../utils/helpers';
import logger from '../utils/logger';

export const googleDriveRouter = Router();

const googleDriveApi = axios.create({
  baseURL: 'https://www.googleapis.com'
});

class NotAllowedMethodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotAllowedMethodError';
  }
}

const allowedBodyMethods = ['post', 'patch'];
const isAllowedBodyMethod = (method: string): method is 'post' | 'patch' => allowedBodyMethods.includes(method);
const allowedNoBodyMethods = ['get', 'delete'];
const isAllowedNoBodyMethod = (method: string): method is 'get' | 'delete' => allowedNoBodyMethods.includes(method);

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

const wrappedBodySchema = objectSchema({
  body: mixedSchema(),
  contentType: stringSchema().required()
}).required();

googleDriveRouter.use(async (req, res) => {
  const methodName = req.method.toLowerCase();
  try {
    const commonRequestConfig = {
      params: {
        ...req.query,
        key: req.path.startsWith('/oauth2') ? undefined : EnvVars.GOOGLE_DRIVE_API_KEY
      },
      headers: omit(toAxiosRequestHeaders(req.headers), 'connection', 'Connection', 'content-length', 'Content-Length')
    };

    let response: AxiosResponse;
    if (isAllowedNoBodyMethod(methodName)) {
      response = await googleDriveApi[methodName](req.path, commonRequestConfig);
    } else if (isAllowedBodyMethod(methodName)) {
      const requestConfig = { ...commonRequestConfig };
      let body = req.body;
      try {
        const { body: newBody, contentType } = await wrappedBodySchema.validate(req.body);
        body = newBody;
        const headersContentTypeKey = isDefined(req.headers['content-type']) ? 'content-type' : 'Content-Type';
        requestConfig.headers[headersContentTypeKey] = contentType;
      } catch {}
      response = await googleDriveApi[methodName](req.path, body, requestConfig);
    } else {
      throw new NotAllowedMethodError('Method Not Allowed');
    }

    // TODO: add setting headers to response if needed
    res.status(response.status).send(response.data);
  } catch (error) {
    logger.error('Google Drive API error', error);

    if (error instanceof NotAllowedMethodError) {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (axios.isAxiosError(error) && error.response) {
      // TODO: add setting headers to response if needed
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});
