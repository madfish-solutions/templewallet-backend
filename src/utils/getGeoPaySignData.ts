import crypto from 'crypto';

export interface GeoPayExchangeInfo {
  from: string;
  to: string;
  fromAmount: number;
  userId: string;
  toPaymentDetails: string;
}

export const getGeoPaySignData = (exchangeInfo: GeoPayExchangeInfo) => {
  const now = +new Date();
  const keys = Object.keys(exchangeInfo).sort();
  let initString = '';
  let parametersSequence = ''; // needed only for check the initString generation sequence.

  for (let i = 0; i < keys.length; i++) {
    if (!exchangeInfo[keys[i]] || typeof exchangeInfo[keys[i]] === 'object') {
      continue;
    }
    initString += keys[i].toLowerCase() + exchangeInfo[keys[i]].toString().toLowerCase();
    parametersSequence += keys[i] + ' | ';
  }

  initString += 'timestamp' + now;
  parametersSequence += 'timestamp';

  const signature = crypto.createHmac('SHA512', process.env.GEOPAY_PRIVATE_KEY!).update(initString).digest('hex');

  console.log('parametersSequence: ' + parametersSequence);
  console.log('initString: ' + initString + '\n');
  console.log('Headers:');
  console.log('trustee-public-key: ' + process.env.GEOPAY_PUBLIC_KEY!);
  console.log('trustee-timestamp: ' + now);
  console.log('trustee-signature: ' + signature);
};
