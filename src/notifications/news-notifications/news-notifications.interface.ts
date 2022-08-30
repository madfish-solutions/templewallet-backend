export enum NewsType {
  News = "News",
  ApplicationUpdate = "ApplicationUpdate",
  Alert = "Alert",
}

export enum PlatformType {
  Mobile = "Mobile",
  Extension = "Extension",
}

export interface NewsNotification {
  id: string;
  createdAt: string;
  type: NewsType;
  platform: PlatformType;
  language: string;
  title: string;
  description: string;
  content: string;
  extensionImageUrl: string;
  mobileImageUrl: string;
  readInOriginalUrl: string;
}