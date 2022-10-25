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
  id: number;
  createdAt: string;
  type: NewsType;
  platforms: PlatformType[];
  language: string;
  title: string;
  description: string;
  content: string;
  extensionImageUrl: string;
  mobileImageUrl: string;
  readInOriginalUrl: string;
}
