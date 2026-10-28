interface DappListItem {
  name: string;
  dappUrl: string;
  type: DappType;
  logo: string;
  slug: string;
  categories: DappType[];
  platforms?: ('extension' | 'mobile')[];
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
    name: 'Tezos Domains',
    dappUrl: 'https://tezos.domains',
    type: DappType.DeFi,
    logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezosdomains/tezosdomains_logo.png',
    slug: 'tezosdomains',
    categories: [DappType.Other]
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
  },
  {
    name: 'Monarch',
    dappUrl: 'https://www.monarchlend.xyz/',
    type: DappType.DeFi,
    logo: 'https://pbs.twimg.com/profile_images/1825396611536855040/5dsqhOJc_400x400.jpg',
    slug: 'monarch',
    categories: [DappType.DeFi]
  },
  {
    name: 'Uranium.io',
    dappUrl: 'https://uranium.io/en',
    type: DappType.DeFi,
    logo: 'https://pbs.twimg.com/profile_images/2038270589446615040/4NFBN0fg_400x400.png',
    slug: 'uranium.io',
    categories: [DappType.DeFi]
  },
  {
    name: 'Rarible',
    dappUrl: 'https://rarible.com/etherlink',
    type: DappType.Marketplaces,
    logo: 'https://pbs.twimg.com/profile_images/1981189339980693504/1iOTxPAt_400x400.jpg',
    slug: 'rarible',
    categories: [DappType.Marketplaces]
  },
  {
    name: 'Metals.io',
    dappUrl: 'https://app.metals.io/en',
    type: DappType.DeFi,
    logo: 'https://app.metals.io/apple-touch-icon.png',
    slug: 'metals.io',
    categories: [DappType.DeFi]
  },
  {
    name: 'Etherlink Bridge',
    dappUrl: 'https://bridge.etherlink.com/',
    type: DappType.DeFi,
    logo: 'https://pbs.twimg.com/profile_images/1984606818983952389/cA_-AAjY_400x400.jpg',
    slug: 'etherlink-bridge',
    categories: [DappType.DeFi]
  },
  {
    name: 'Limitless',
    dappUrl: 'https://limitless.exchange?r=2652F3LLC2',
    type: DappType.Other,
    logo: 'https://limitless.exchange/apple-touch-icon.png',
    slug: 'limitless',
    categories: [DappType.Other],
    platforms: ['extension']
  },
  {
    name: 'Tezos Systems',
    dappUrl: 'https://tezos.systems/',
    type: DappType.Other,
    logo: 'https://tezos.systems/apple-touch-icon.png',
    slug: 'tezos-systems',
    categories: [DappType.Other]
  },
  {
    name: 'Tezos X',
    dappUrl: 'https://tezos.com/tezos-x/',
    type: DappType.Other,
    logo: 'https://pbs.twimg.com/profile_images/1984562534620278784/cRXlDZNX_400x400.jpg',
    slug: 'tezos-x',
    categories: [DappType.Other]
  },
  {
    name: 'teia',
    dappUrl: 'https://teia.art/',
    type: DappType.Marketplaces,
    logo: 'https://pbs.twimg.com/profile_images/1488781154392100864/8GbKpp-b_400x400.png',
    slug: 'teia',
    categories: [DappType.Marketplaces]
  }
];
