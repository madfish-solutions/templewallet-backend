import { Request, Response, Router } from 'express';
import * as yup from 'yup';

import { EnvVars } from '../config';

// Docs: https://exolix.com/developers
const EXOLIX_API_URL = 'https://exolix.com/api/v2';
const REQUEST_TIMEOUT_MS = 30000;
const codeSchema = yup.string().max(128).required();
const currenciesQuerySchema = yup.object({
  page: yup.number().integer().positive().default(1),
  size: yup.number().integer().positive().max(100).default(100),
  withNetworks: yup.boolean().default(true)
});
const rateQuerySchema = yup.object({
  coinFrom: codeSchema,
  networkFrom: codeSchema,
  coinTo: codeSchema,
  networkTo: codeSchema,
  amount: yup.number().min(0).max(Number.MAX_VALUE).required(),
  rateType: yup.string().oneOf(['fixed']).default('fixed')
});
const transactionBodySchema = rateQuerySchema.shape({
  amount: yup.number().positive().max(Number.MAX_VALUE).required(),
  withdrawalAddress: yup.string().max(512).required(),
  withdrawalExtraId: yup.string().max(512).default('')
});
const transactionIdSchema = yup
  .string()
  .matches(/^[a-zA-Z0-9_-]{1,128}$/)
  .required();

interface ExolixProxyRequest {
  endpoint: string;
  query?: Record<string, string | number | boolean>;
  body?: yup.InferType<typeof transactionBodySchema>;
}

async function proxyExolixRequest(res: Response, { endpoint, query, body }: ExolixProxyRequest): Promise<void> {
  const apiKey = EnvVars.EXOLIX_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Exolix API is not configured' });

    return;
  }

  const url = new URL(`${EXOLIX_API_URL}${endpoint}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const responseBody = await response.text();

    res.status(response.status).type('application/json').send(responseBody.split(apiKey).join('[REDACTED]'));
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    res.status(isTimeout ? 504 : 502).json({ error: isTimeout ? 'Exolix API timed out' : 'Exolix API request failed' });
  }
}

function handleProxyRequest(
  getRequest: (req: Request) => Promise<ExolixProxyRequest>
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && Object.values(req.query).some(value => typeof value !== 'string')) {
      res.status(400).json({ error: 'Invalid Exolix request' });

      return;
    }

    try {
      await proxyExolixRequest(res, await getRequest(req));
    } catch {
      res.status(400).json({ error: 'Invalid Exolix request' });
    }
  };
}

export const exolixRouter = Router();

exolixRouter.get(
  '/currencies',
  handleProxyRequest(async req => ({
    endpoint: '/currencies',
    query: await currenciesQuerySchema.validate(req.query, { stripUnknown: true })
  }))
);
exolixRouter.get(
  '/rate',
  handleProxyRequest(async req => ({
    endpoint: '/rate',
    query: await rateQuerySchema.validate(req.query, { stripUnknown: true })
  }))
);
exolixRouter.post(
  '/transactions',
  handleProxyRequest(async req => ({
    endpoint: '/transactions',
    body: await transactionBodySchema.validate(req.body, { stripUnknown: true })
  }))
);
exolixRouter.get(
  '/transactions/:id',
  handleProxyRequest(async req => ({
    endpoint: `/transactions/${await transactionIdSchema.validate(req.params.id)}`
  }))
);
