import { Notification, NotificationType, PlatformType } from "./notification.interface";

const BANNERS_BUCKET_URL = 'https://generic-objects.fra1.digitaloceanspaces.com/notification-icons';

const DEFAULT_BANNER_URLS = {
  extension: {
    news: `${BANNERS_BUCKET_URL}/extension/news.svg`,
    platformUpdate: `${BANNERS_BUCKET_URL}/extension/platform-update.svg`,
    securityNote: `${BANNERS_BUCKET_URL}/extension/security-note.svg`
  },
  mobile: {
    news: `${BANNERS_BUCKET_URL}/mobile/news.svg`,
    platformUpdate: `${BANNERS_BUCKET_URL}/mobile/platform-update.svg`,
    securityNote: `${BANNERS_BUCKET_URL}/mobile/security-note.svg`
  }
};

export const NOTIFICATIONS_LIST: Notification[] = [
  {
    id: 2,
    createdAt: '2022-11-29T13:00:00.000Z',
    type: NotificationType.PlatformUpdate,
    platforms: [PlatformType.Mobile],
    language: 'en-US',
    title: 'Test',
    description: 'Please read this short write-up to learn how we help you secure your wallet and what additional steps you may take on your part.',
    content: "UPDATE TEST",
    extensionImageUrl: DEFAULT_BANNER_URLS.extension.platformUpdate,
    mobileImageUrl: DEFAULT_BANNER_URLS.mobile.platformUpdate
  },
  {
    id: 1,
    createdAt: '2022-11-29T13:00:00.000Z',
    type: NotificationType.SecurityNote,
    platforms: [PlatformType.Extension],
    language: 'en-US',
    title: 'A note on security',
    description: 'Please read this short write-up to learn how we help you secure your wallet and what additional steps you may take on your part.',
    content: "Attention!\n" +
      "Never and under any pretext share your private keys and a seed phrase with the third parties.\n" +
      "\n" +
      "Also, remember:\n" +
      " • Your wallet can be targeted through a browser’s zero-day exploit or via other malicious extensions installed;\n" +
      " • The screen can potentially be manipulated by malicious software installed in the system;\n" +
      " • User’s host machine can be targeted by malware to steal encrypted wallet;\n" +
      " • Choosing weak passwords can reduce the ability of a wallet to resist adversarial brute-forcing.\n" +
      "\n" +
      "To keep your assets safe, we recommend:\n" +
      " • Move your funds from “hot” wallet to “cold” as soon as possible (Temple wallet supports integration with “Ledger Nano” devices);\n" +
      " • Use separate browsers for web-surfing and wallet’s operating;\n" +
      " • Use one browser’s tab at a time to make transactions;\n" +
      " • Keep the wallet locked when it is not in usage.\n" +
      "\n" +
      "Take care of your safety in the crypto world!\n",
    extensionImageUrl: DEFAULT_BANNER_URLS.extension.securityNote,
    mobileImageUrl: DEFAULT_BANNER_URLS.mobile.securityNote,
    link: {
      url: 'https://madfish.crunch.help/temple-wallet/a-note-on-security',
      beforeLinkText: 'You can find even more security tips ',
      linkText: 'here',
      afterLinkText: '.'
    }
  },
  {
    id: 0,
    createdAt: '2022-11-29T13:00:00.000Z',
    type: NotificationType.SecurityNote,
    platforms: [PlatformType.Mobile],
    language: 'en-US',
    title: 'A note on security [update]',
    description: 'Please read this short write-up to learn how we help you secure your wallet and what additional steps you may take on your part.',
    content: "Attention\n" +
      "\n" +
      "Never and under any pretext share your private keys and seed phrases with the third parties.\n" +
      "\n" +
      "Also, remember:\n" +
      " • Your wallet can be targeted through a zero-day exploit or via other malicious software installed;\n" +
      " • The screen can potentially be manipulated by malicious software installed in the system;\n" +
      " • User’s device can be targeted by malware to steal encrypted wallet;\n" +
      " • Choosing weak passwords can reduce the ability of a wallet to resist adversarial brute-forcing.\n" +
      "\n" +
      "To keep your assets safe, we recommend:\n" +
      " • Ideally, use separate devices for web-surfing and wallet’s operating;\n" +
      " • Use one browser’s tab at a time to make transactions;\n" +
      " • Keep the wallet locked when it is not in usage.\n" +
      "\n" +
      "Take care of your safety in the crypto world!\n",
    extensionImageUrl: DEFAULT_BANNER_URLS.extension.securityNote,
    mobileImageUrl: DEFAULT_BANNER_URLS.mobile.securityNote,
    link: {
      url: 'https://madfish.crunch.help/temple-wallet/a-note-on-security',
      beforeLinkText: 'You can find even more security tips ',
      linkText: 'here',
      afterLinkText: '.'
    }
  }
]
