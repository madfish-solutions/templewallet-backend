import { config } from 'dotenv';
import path from 'path';

if (!Boolean(process.env.NETWORK_RPC)) {
  console.log('Applying .env configuration');
  config({ path: path.join(__dirname, '../.env') });
}
