import axios from 'axios';
import * as yup from 'yup';

import { EnvVars } from '../config';

interface SessionResponse {
  sessionId: string;
  requestId: string;
}

const CREATE_SESSION_URL = 'https://partner.wert.io/api/external/hpp/create-session';

export const wertSessionParamsSchema = yup
  .object({
    walletAddress: yup.string().trim().min(1).max(128).required(),
    commodity: yup.string().trim().min(1).max(32).required(),
    network: yup.string().trim().min(1).max(32).required(),
    currencyAmount: yup.number().positive().optional()
  })
  .required();

type WertSessionParams = yup.InferType<typeof wertSessionParamsSchema>;

const postCreateSession = (body: Record<string, string | number>) =>
  axios
    .post<SessionResponse>(CREATE_SESSION_URL, body, {
      headers: {
        'X-Api-Key': EnvVars.WERT_API_KEY,
        'Content-Type': 'application/json'
      }
    })
    .then(res => res.data.sessionId);

/** https://docs.wert.io/docs/fiat-onramp */
export const createWertSession = ({ walletAddress, commodity, network, currencyAmount }: WertSessionParams) =>
  postCreateSession({
    flow_type: 'simple',
    wallet_address: walletAddress,
    commodity,
    network,
    currency: 'USD',
    ...(currencyAmount === undefined ? {} : { currency_amount: currencyAmount })
  });

/** @deprecated Kept for extension versions that still build the widget URL themselves */
export const getWertSessionId = () => postCreateSession({ flow_type: 'simple' });
