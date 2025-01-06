import { Request, Response } from 'express';

import { EnvVars } from './config';

export async function handleTempleTapApiProxyRequest(req: Request, res: Response, endpoint: string, method = 'POST') {
  try {
    const response = await fetch(new URL(endpoint, EnvVars.TEMPLE_TAP_API_URL + '/'), {
      method,
      body: JSON.stringify(req.body),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const statusCode = String(response.status);
    const responseBody = await response.text();

    if (statusCode.startsWith('2') || statusCode.startsWith('4')) {
      res.status(response.status).send(responseBody);

      return;
    }

    throw new Error(responseBody);
  } catch (error) {
    console.error('Temple Tap API proxy endpoint exception:', error);

    res.status(500).send({ message: 'Unknown error' });
  }
}
