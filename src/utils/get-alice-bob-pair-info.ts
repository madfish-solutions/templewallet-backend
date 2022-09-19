import axios from 'axios';
import crypto from 'crypto';

export const getAliceBobPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const now = +new Date();
  let initString = 'timestamp' + now;
  const signature = crypto.createHmac('SHA512', process.env.ALICE_BOB_PRIVATE_KEY!).update(initString).digest('hex');

  const response = await axios.get<{ minamount: string, maxamount: string }>(
    'https://api.abex.pro/api/v3/get-pair-info/' + pair,
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return response.data;
};
