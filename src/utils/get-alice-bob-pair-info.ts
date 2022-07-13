import axios from 'axios';
import crypto from 'crypto';

export const getAliceBobPairInfo = async () => {
  const now = +new Date();
  let initString = 'timestamp' + now;
  const signature = crypto.createHmac('SHA512', process.env.ALICE_BOB_PRIVATE_KEY!).update(initString).digest('hex');

  const response = await axios.get<{ minamount: string, maxamount: string }>(
    'https://exchange.alice-bob.io/api/v3/get-pair-info/CARDUAH/TEZ',
    {
      headers: {
        'public-key': process.env.ALICE_BOB_PUBLIC_KEY!,
        'timestamp': now,
        signature
      }
    });

  return { minAmount: response.data.minamount, maxAmount: response.data.maxamount };
};
