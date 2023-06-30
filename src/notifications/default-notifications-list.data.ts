import { DEFAULT_IMAGE_URLS } from './default-image-fallbacks';
import { Notification, NotificationType, PlatformType } from './notification.interface';

//TODO: delete after deploy
export const DEFAULT_NOTIFICATIONS_LIST: Notification[] = [
  {
    id: 4,
    createdAt: '2022-12-29T16:00:00.000Z',
    type: NotificationType.News,
    platforms: [PlatformType.Mobile],
    language: 'en-US',
    title: 'Temple mobile update!',
    description:
      'Don’t forget to update your Mobile app to the latest version. Click “Details” to learn what’s in this patch.',
    content: [
      'In this update:\n',
      ' • The new market feature was released. Track your favorite Tezos coins directly in your wallet. Add to favorites by clicking the star icon, or instantly buy tokens you like. To start using all features - choose a token and swipe it.\n',
      ' • Added fixes related to the latest Taquito update.\n',
      ' • Other minor improvements.\n',
      '\n',
      'Check whether your mobile app has the latest version.'
    ],
    extensionImageUrl: DEFAULT_IMAGE_URLS.extension.news,
    mobileImageUrl: DEFAULT_IMAGE_URLS.mobile.news
  },
  {
    id: 3,
    createdAt: '2022-12-19T15:00:00.000Z',
    type: NotificationType.News,
    platforms: [PlatformType.Extension, PlatformType.Mobile],
    language: 'en-US',
    title: 'Win a free NFT by Mario Klingemann',
    description:
      'Use the Quipuswap/Allbridge Tezos cross-chain Bridge to win a limited edition nft by a famous nft artist.',
    content: [
      'To raise awareness about the new cross-chain bridge MadFish and Allbridge teamed up with one of the top digital artists on Tezos - Mario Klingemann (a.k.a @Quasimondo).\n',
      '\n',
      'How to participate:\n',
      ' • Bridge at least $200 worth of BUSD (BNB Chain), USDC (Polygon), or ABR (any) to Tezos using Allbridge.\n',
      ' • Buy any NFT on Teia.art, Rarible.com (tezos nfts only), or Objkt.com.\n',
      ' • Win one of the 75 unique NFTs by a famous artist.\n',
      '\n',
      'Participants are automatically registered, and no further user action is required.\n',
      '\n',
      {
        text: 'Read more.',
        url: 'https://story.madfish.solutions/discover-the-tezos-nft-world-and-stand-a-chance-to-win-an-nft-artwork-by-the-famous-artist-mario-klingemann/'
      }
    ],
    extensionImageUrl: DEFAULT_IMAGE_URLS.extension.winNft,
    mobileImageUrl: DEFAULT_IMAGE_URLS.mobile.winNft
  }
];
