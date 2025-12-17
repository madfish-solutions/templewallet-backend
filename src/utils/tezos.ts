import { MichelCodecPacker, Signer, TezosToolkit } from '@taquito/taquito';
const RPC_URL = process.env.RPC_URL ?? 'https://mainnet-node.madfish.solutions';
const TEMPLE_WALLET_LV_ACCOUNT_PKH = 'tz1fVQangAfb9J1hRRMP2bSB6LvASD6KpY8A';
const TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY = 'edpkvWbk81uh1DEvdWKR4g1bjyTGhdu1mDvznPUFE2zDwNsLXrEb9K';

class LambdaViewSigner implements Signer {
  async publicKeyHash() {
    return TEMPLE_WALLET_LV_ACCOUNT_PKH;
  }

  async publicKey() {
    return TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY;
  }

  async secretKey(): Promise<string> {
    throw new Error('Secret key cannot be exposed');
  }

  async sign(): Promise<{
    bytes: string;
    sig: string;
    prefixSig: string;
    sbytes: string;
  }> {
    throw new Error('Cannot sign');
  }
}

const lambdaSigner = new LambdaViewSigner();
const michelEncoder = new MichelCodecPacker();

export const tezosToolkit = new TezosToolkit(RPC_URL);
tezosToolkit.setSignerProvider(lambdaSigner);
tezosToolkit.setPackerProvider(michelEncoder);
