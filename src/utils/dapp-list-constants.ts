interface DappListItem {
  name: string;
  dappUrl: string;
  type: DappType;
  logo: string;
  slug: string;
  categories: DappType[];
}

enum DappType {
  Exchanges = 'Exchanges',
  Marketplaces = 'Marketplaces',
  Games = 'Games',
  DeFi = 'DeFi',
  Collectibles = 'Collectibles',
  Other = 'Other'
}

export const DAPPS_LIST: DappListItem[] = [
  {
    name: 'QuipuSwap',
    dappUrl: 'https://quipuswap.com',
    type: DappType.Exchanges,
    logo: 'https://pbs.twimg.com/profile_images/1491744744455782403/MughfxNS_400x400.jpg',
    slug: 'quipuswap',
    categories: [DappType.Exchanges, DappType.DeFi]
  },
  {
    name: 'Objkt.com',
    dappUrl: 'https://objkt.com',
    type: DappType.Marketplaces,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/objkt/objkt_logo.png',
    slug: 'objkt.com',
    categories: [DappType.Marketplaces]
  },
  {
    name: 'LetsExchange',
    dappUrl: 'https://letsexchange.io/?ref_id=CtN9tIep5v36D2mb',
    type: DappType.Exchanges,
    logo: 'https://pbs.twimg.com/profile_images/1774777048839454720/aAHa9Xlt_400x400.jpg',
    slug: 'letsexchange',
    categories: [DappType.Exchanges]
  },
  {
    name: 'Opensea',
    dappUrl: 'https://opensea.io',
    type: DappType.Marketplaces,
    logo: 'https://pbs.twimg.com/profile_images/2014958165050507264/dvbOLNLL_400x400.jpg',
    slug: 'opensea',
    categories: [DappType.Marketplaces]
  },
  {
    name: 'PixelPotus',
    dappUrl: 'https://www.pixelpotus.com',
    type: DappType.Collectibles,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/pixelpotus/pixelpotus_logo.png',
    slug: 'pixelpotus',
    categories: [DappType.Collectibles, DappType.Games]
  },
  {
    name: 'Tezotopia',
    dappUrl: 'https://tezotop.io',
    type: DappType.Games,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezotopia/tezotopia_logo.png',
    slug: 'tezotopia',
    categories: [DappType.Games, DappType.Collectibles]
  },
  {
    name: 'Tezos Domains',
    dappUrl: 'https://tezos.domains',
    type: DappType.DeFi,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezosdomains/tezosdomains_logo.png',
    slug: 'tezosdomains',
    categories: [DappType.Other]
  },
  {
    name: 'Youves',
    dappUrl: 'https://app.youves.com/?ref=tz1UbRzhYjQKTtWYvGUWcRtVT4fN3NESDVYT',
    type: DappType.DeFi,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/youves/youves_logo.png',
    slug: 'youves',
    categories: [DappType.DeFi, DappType.Exchanges]
  },
  {
    name: 'Kolibri',
    dappUrl: 'https://kolibri.finance',
    type: DappType.DeFi,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/kolibri/kolibri_logo.png',
    slug: 'kolibri',
    categories: [DappType.DeFi, DappType.Other]
  },
  {
    name: 'Stacyfi',
    dappUrl: 'https://stacy.fi',
    type: DappType.DeFi,
    logo: 'https://docs.youves.com/img/stXTZ_48px.png',
    slug: 'stacyfi',
    categories: [DappType.DeFi, DappType.Other]
  }
];
