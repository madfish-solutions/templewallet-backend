import { HTMLElement } from 'node-html-parser';
import * as yup from 'yup';

import { mtPelerinCurrenciesUrl, mtPelerinTokensMetadataUrl } from './common';

export type MTPelerinNetwork =
  | 'arbitrum_mainnet'
  | 'avalanche_mainnet'
  | 'base_mainnet'
  | 'bitcoin_mainnet'
  | 'bsc_mainnet'
  | 'celo_mainnet'
  | 'fantom_mainnet'
  | 'lightning_mainnet'
  | 'mainnet'
  | 'matic_mainnet'
  | 'optimism_mainnet'
  | 'rsk_mainnet'
  | 'sonic_mainnet'
  | 'tempo_mainnet'
  | 'tezos_mainnet'
  | 'xdai_mainnet'
  | 'zksync_mainnet';

const networkNames: Record<string, MTPelerinNetwork> = {
  arbitrum: 'arbitrum_mainnet',
  arbitrumone: 'arbitrum_mainnet',
  avalanche: 'avalanche_mainnet',
  avalanchecchain: 'avalanche_mainnet',
  base: 'base_mainnet',
  bitcoin: 'bitcoin_mainnet',
  btc: 'bitcoin_mainnet',
  bnbchain: 'bsc_mainnet',
  bsc: 'bsc_mainnet',
  binancesmartchain: 'bsc_mainnet',
  celo: 'celo_mainnet',
  fantom: 'fantom_mainnet',
  bitcoinlightning: 'lightning_mainnet',
  bitcoinlightningnetwork: 'lightning_mainnet',
  lightning: 'lightning_mainnet',
  lightningnetwork: 'lightning_mainnet',
  ethereum: 'mainnet',
  ethereummainnet: 'mainnet',
  polygon: 'matic_mainnet',
  polygonpos: 'matic_mainnet',
  matic: 'matic_mainnet',
  optimism: 'optimism_mainnet',
  rootstock: 'rsk_mainnet',
  rsk: 'rsk_mainnet',
  sonic: 'sonic_mainnet',
  tempo: 'tempo_mainnet',
  tezos: 'tezos_mainnet',
  gnosischain: 'xdai_mainnet',
  gnosis: 'xdai_mainnet',
  xdai: 'xdai_mainnet',
  xdaichain: 'xdai_mainnet',
  zksync: 'zksync_mainnet',
  zksyncera: 'zksync_mainnet'
};

const mtPelerinNetworkSchema = yup.mixed<MTPelerinNetwork>().oneOf(Object.values(networkNames)).required();

const mtPelerinTokenMetadataSchema = yup
  .object({
    symbol: yup.string().required(),
    network: mtPelerinNetworkSchema,
    networkName: yup.string().required(),
    decimals: yup.number().required(),
    address: yup.string().required(),
    isStable: yup.boolean().required(),
    networkFee: yup.number().optional(),
    forceNetworkFee: yup.boolean().optional(),
    tokenId: yup.number().optional()
  })
  .required();

const mtPelerinParsedTokenSchema = yup
  .object({
    network: yup.string().required(),
    iconPath: yup.string().required(),
    symbol: yup.string().required(),
    name: yup.string().required()
  })
  .required();

const mtPelerinTokenMetadataResponseSchema = yup.object().required();

export type MtPelerinTokenMetadata = yup.InferType<typeof mtPelerinTokenMetadataSchema> & { id: string };

interface MtPelerinParsedToken {
  network: MTPelerinNetwork;
  iconUrl: string;
  symbol: string;
  name: string;
}

export interface MtPelerinToken extends MtPelerinParsedToken, MtPelerinTokenMetadata {}

const parseCryptoTokenMetadataEntry = (id: string, value: unknown): MtPelerinTokenMetadata => {
  return {
    id,
    ...mtPelerinTokenMetadataSchema.validateSync(value)
  };
};

const parseCryptoTokenMetadata = (value: unknown): MtPelerinTokenMetadata[] => {
  const metadataById = mtPelerinTokenMetadataResponseSchema.validateSync(value);

  return Object.entries(metadataById).map(([id, metadata]) => parseCryptoTokenMetadataEntry(id, metadata));
};

export const fetchCryptoTokenMetadata = async (): Promise<MtPelerinTokenMetadata[]> => {
  const response = await fetch(mtPelerinTokensMetadataUrl);

  if (!response.ok) {
    throw new Error(`Mt Pelerin metadata endpoint returned status ${response.status}`);
  }

  return parseCryptoTokenMetadata(await response.json());
};

const mapNetworkName = (network: string) => {
  const normalizedNetwork = network.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappedNetwork = networkNames[normalizedNetwork];

  if (mappedNetwork === undefined) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return mappedNetwork;
};

const parseSupportedCryptoTokens = (root: HTMLElement): MtPelerinParsedToken[] => {
  const currenciesTable = root
    .querySelectorAll('#currencieslist')
    .find(table => table.querySelector('a[href^="/price/"]') !== null);

  if (currenciesTable === undefined) {
    throw new Error('Currencies table is missing');
  }

  let network: string | undefined;
  const tokens: MtPelerinParsedToken[] = [];

  for (const row of currenciesTable.querySelectorAll('tr')) {
    const tokenIcon = row.querySelector('img.currency-icon');

    if (tokenIcon === null) {
      const networkIcon = row.querySelector('img');
      const networkAlt = networkIcon?.getAttribute('alt')?.trim();
      network = networkAlt?.toLowerCase().endsWith(' logo') === true ? networkAlt.slice(0, -5).trim() : networkAlt;
      continue;
    }

    const [, symbolCell, nameCell] = row.querySelectorAll('td');
    const iconPath = tokenIcon.attributes['data-src'] ?? tokenIcon.attributes.src;
    const parsedToken = mtPelerinParsedTokenSchema.validateSync({
      network,
      iconPath,
      symbol: symbolCell?.text.trim(),
      name: nameCell?.text.trim()
    });

    tokens.push({
      network: mapNetworkName(parsedToken.network),
      iconUrl: new URL(parsedToken.iconPath, mtPelerinCurrenciesUrl).toString(),
      symbol: parsedToken.symbol,
      name: parsedToken.name
    });
  }

  if (tokens.length === 0) {
    throw new Error('Currencies list is empty');
  }

  return tokens;
};

const addCryptoTokenMetadata = (
  tokens: MtPelerinParsedToken[],
  metadata: MtPelerinTokenMetadata[]
): MtPelerinToken[] => {
  const metadataByToken = new Map(metadata.map(item => [`${item.network}:${item.symbol}`, item]));

  return tokens.map(token => {
    const tokenMetadata = metadataByToken.get(`${token.network}:${token.symbol}`);

    if (tokenMetadata === undefined) {
      throw new Error(`Metadata is missing for ${token.symbol} on ${token.network}`);
    }

    return {
      ...token,
      ...tokenMetadata
    };
  });
};

export const parseCryptoTokens = (root: HTMLElement, metadata: MtPelerinTokenMetadata[]): MtPelerinToken[] =>
  addCryptoTokenMetadata(parseSupportedCryptoTokens(root), metadata);
