import axios from 'axios';

import { EnvVars } from '../config';

interface SessionResponse {
  sessionId: string;
  requestId: string;
}

/** https://docs.wert.io/docs/fiat-onramp */
export const getWertSessionId = () =>
  axios
    .post<SessionResponse>(
      'https://partner.wert.io/api/external/hpp/create-session',
      { flow_type: 'simple' },
      {
        headers: {
          'X-Api-Key': EnvVars.WERT_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )
    .then(res => res.data.sessionId);
