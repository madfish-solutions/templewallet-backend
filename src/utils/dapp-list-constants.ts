interface DappList {
    name: string;
    dappUrl: string;
    type: DappType;
    logo: string;
    slug: string;
    categories: DappType[];
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
        name: "QuipuSwap",
        dappUrl: 'https://quipuswap.com',
        type: DappType.Exchanges,
        logo: "https://dashboard-assets.dappradar.com/document/7360/quipuswap-dapp-exchanges-tezos-logo-166x166_ebde5a0933878146d43d79b2cdd754f8.png",
        slug: "quipuswap",
        categories: [DappType.Exchanges, DappType.DeFi]
    },
    {
        name: "Yupana",
        dappUrl: 'https://yupana.finance',
        type: DappType.DeFi,
        logo: "https://pbs.twimg.com/profile_images/1450382829062393859/NSu06S5C_400x400.png",
        slug: "yupana",
        categories: [DappType.DeFi]
    },
    {
        name: "Objkt.com",
        dappUrl: 'https://objkt.com',
        type: DappType.Marketplaces,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/objkt/objkt_logo.png',
        slug: 'objkt.com',
        categories: [DappType.Marketplaces]
    },
    {
        name: "PixelPotus",
        dappUrl: 'https://www.pixelpotus.com',
        type: DappType.Collectibles,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/pixelpotus/pixelpotus_logo.png',
        slug: 'pixelpotus',
        categories: [DappType.Collectibles, DappType.Games]
    },
    {
        name: "DOGAMÍ",
        dappUrl: 'https://dogami.com',
        type: DappType.Games,
        logo: 'https://dashboard-assets.dappradar.com/document/13974/dogam-dapp-games-tezos-logo-166x166_b7394b584e1bfd58e7d5ef8a654fae0c.png',
        slug: 'dogami',
        categories: [DappType.Games, DappType.Collectibles]
    },
    {
        name: "Tezotopia",
        dappUrl: 'https://tezotop.io',
        type: DappType.Games,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezotopia/tezotopia_logo.png',
        slug: 'tezotopia',
        categories: [DappType.Games, DappType.Collectibles]
    },
    {
        name: "Tezos Domains",
        dappUrl: 'https://tezos.domains',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/tezosdomains/tezosdomains_logo.png',
        slug: 'tezosdomains',
        categories: [DappType.Other]
    },
    {
        name: "DNS.xyz",
        dappUrl: 'https://dns.xyz/',
        type: DappType.DeFi,
        logo: 'https://pbs.twimg.com/profile_images/1527763993577697280/ksQvdq_8_400x400.jpg',
        slug: 'dnsxyz',
        categories: [DappType.Marketplaces, DappType.Collectibles]
    },
    {
        name: "Plenty",
        dappUrl: 'https://www.plentydefi.com',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/plenty/plenty_logo.png',
        slug: 'plenty',
        categories: [DappType.DeFi, DappType.Exchanges]
    },
    {
        name: "Kalamint",
        dappUrl: 'https://kalamint.io',
        type: DappType.Marketplaces,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/kalamint/kalamint_logo.png',
        slug: 'kalamint',
        categories: [DappType.Marketplaces]
    },
    {
        name: "Smartlink",
        dappUrl: 'https://www.smartlink.so',
        type: DappType.DeFi,
        logo: 'https://dashboard-assets.dappradar.com/document/7516/smartlink-dapp-marketplaces-tezos-logo-166x166_68ee1ea922aabc1934817dcdb49b07db.png',
        slug: 'smartlink',
        categories: [DappType.DeFi, DappType.Exchanges]
    },
    {
        name: "Youves",
        dappUrl: 'https://app.youves.com/?ref=tz1UbRzhYjQKTtWYvGUWcRtVT4fN3NESDVYT',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/youves/youves_logo.png',
        slug: 'youves',
        categories: [DappType.DeFi, DappType.Exchanges]
    },
    {
        name: "Crunchy",
        dappUrl: 'https://app.crunchy.network',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/crunchy/crunchy_logo.jpg',
        slug: 'crunchy',
        categories: [DappType.DeFi]
    },
    {
        name: "Kolibri",
        dappUrl: 'https://kolibri.finance',
        type: DappType.DeFi,
        logo: 'https://bcd-static-assets.fra1.digitaloceanspaces.com/dapps/kolibri/kolibri_logo.png',
        slug: 'kolibri',
        categories: [DappType.DeFi, DappType.Other]
    },
    {
        name: "signum",
        dappUrl: 'https://signum.loans',
        type: DappType.DeFi,
        logo: 'https://pbs.twimg.com/profile_images/1578001954026016768/aYYGtOsL_200x200.jpg',
        slug: 'signum',
        categories: [DappType.DeFi, DappType.Collectibles]
    }
  ]
