export enum NotificationType {
  News = 'News',
  PlatformUpdate = 'PlatformUpdate',
  SecurityNote = 'SecurityNote',
  OfferReceived = 'OfferReceived',
  AuctionBid = 'AuctionBid',
  NftSold = 'NftSold'
}

export type AccountNotificationType =
  | NotificationType.OfferReceived
  | NotificationType.AuctionBid
  | NotificationType.NftSold;

export const ACCOUNT_NOTIFICATION_TYPES: AccountNotificationType[] = [
  NotificationType.OfferReceived,
  NotificationType.AuctionBid,
  NotificationType.NftSold
];

export enum PlatformType {
  Mobile = 'Mobile',
  Extension = 'Extension'
}

export interface NotificationLink {
  text: string;
  url: string;
}

export interface Notification {
  id: number;
  createdAt: string;
  type: NotificationType;
  platforms: PlatformType[];
  language: string;
  title: string;
  description: string;
  content: Array<string | NotificationLink>;
  extensionImageUrl: string;
  mobileImageUrl: string;
  sourceUrl?: string;
  expirationDate?: string;
  isMandatory?: boolean;
}

export interface AccountNotification extends Notification {
  type: AccountNotificationType;
  accountAddresses: string[];
}

export const isAccountNotificationType = (type: unknown): type is AccountNotificationType =>
  ACCOUNT_NOTIFICATION_TYPES.some(accountNotificationType => accountNotificationType === type);
