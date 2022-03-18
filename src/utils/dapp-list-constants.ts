interface DappList {
  id: number;
  name: string;
  dappUrl: string;
  type: string;
  logo: string;
  slug: string;
  categories: string[];
}

enum DappType {
  Exchanges = "Exchanges",
  Marketplaces = "Marketplaces",
  Games = "Games",
  DeFi = "DeFi",
  Collectibles = "Collectibles",
  Other = "Other"
}

export const dappList: DappList[] = [
    {
        id: 1,
        name: "QuipuSwap",
        dappUrl: 'https://quipuswap.com',
        type: DappType.Exchanges,
        logo: "https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/quipuswap/quipuswap_logo.jpg",
        slug: "quipuswap",
        categories: [DappType.Exchanges]
    },
    {
        id: 2,
        name: "Objkt.com",
        dappUrl: 'objkt.com',
        type: DappType.Marketplaces,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/objkt/objkt_logo.png',
        slug: 'objkt.com',
        categories: [DappType.Marketplaces]
    },
    {
        id: 3,
        name: "Hic et Nunc",
        dappUrl: 'https://www.hicetnunc.xyz',
        type: DappType.Marketplaces,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/hen/hen_logo.jpg',
        slug: 'hen',
        categories: [DappType.Marketplaces]
    },
    {
        id: 4,
        name: "PixelPotus",
        dappUrl: 'https://www.pixelpotus.com',
        type: DappType.Collectibles,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/pixelpotus/pixelpotus_logo.png',
        slug: 'pixelpotus',
        categories: [DappType.Collectibles]
    },
    {
        id: 5,
        name: "DOGAMÍ",
        dappUrl: 'https://dogami.com',
        type: DappType.Games,
        logo: 'https://dashboard-assets.dappradar.com/document/13974/dogam-dapp-games-tezos-logo-166x166_b7394b584e1bfd58e7d5ef8a654fae0c.png',
        slug: 'dogami',
        categories: [DappType.Games]
    },
    {
        id: 6,
        name: "Tezotopia",
        dappUrl: 'https://tezotop.io',
        type: DappType.Games,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezotopia/tezotopia_logo.png',
        slug: 'tezotopia',
        categories: [DappType.Games]
    },
    {
        id: 7,
        name: "Tezos Domains",
        dappUrl: 'https://tezos.domains',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezosdomains/tezosdomains_logo.png',
        slug: 'tezosdomains',
        categories: [DappType.DeFi]
    },
    {
        id: 8,
        name: "Plenty",
        dappUrl: 'https://www.plentydefi.com ',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/plenty/plenty_logo.png',
        slug: 'plenty',
        categories: [DappType.DeFi]
    },
    {
        id: 9,
        name: "Kalamint",
        dappUrl: 'https://kalamint.io',
        type: DappType.Marketplaces,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/kalamint/kalamint_logo.png',
        slug: 'kalamint',
        categories: [DappType.Marketplaces]
    },
    {
        id: 10,
        name: "Smartlink",
        dappUrl: 'https://www.smartlink.so',
        type: DappType.DeFi,
        logo: 'https://dashboard-assets.dappradar.com/document/7516/smartlink-dapp-marketplaces-tezos-logo-166x166_68ee1ea922aabc1934817dcdb49b07db.png',
        slug: 'smartlink',
        categories: [DappType.DeFi]
    },
    {
        id: 11,
        name: "Youves",
        dappUrl: 'https://app.youves.com',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/youves/youves_logo.png',
        slug: 'youves',
        categories: [DappType.DeFi]
    },
    {
        id: 12,
        name: "Crunchy",
        dappUrl: 'https://app.crunchy.network',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/crunchy/crunchy_logo.jpg',
        slug: 'crunchy',
        categories: [DappType.DeFi]
    },
    {
        id: 13,
        name: "Alien'sFarm",
        dappUrl: 'https://aliens.farm',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/aliensfarm/aliensfarm_logo.png',
        slug: 'aliensfarm',
        categories: [DappType.DeFi]
    },
    {
        id: 14,
        name: "FlameDeFi",
        dappUrl: 'https://flamedefi.io',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/flame/flame_logo.jpg',
        slug: 'flamedefi',
        categories: [DappType.DeFi]
    },
    {
        id: 15,
        name: "Kolibri",
        dappUrl: 'https://kolibri.finance',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/kolibri/kolibri_logo.png',
        slug: 'kolibri',
        categories: [DappType.DeFi]
    }
]