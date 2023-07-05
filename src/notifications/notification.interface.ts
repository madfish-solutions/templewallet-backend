export enum NotificationType {
  News = 'News',
  PlatformUpdate = 'PlatformUpdate',
  SecurityNote = 'SecurityNote'
}

export enum PlatformType {
  Mobile = 'Mobile',
  Extension = 'Extension'
}

export interface NotificationLink {
  text: string;
  url: string;
}

export interface Notification {
  id: string;
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
