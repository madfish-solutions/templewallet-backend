export enum NotificationType {
  News = "News",
  PlatformUpdate = "PlatformUpdate",
  SecurityNote = "SecurityNote",
}

export enum PlatformType {
  Mobile = "Mobile",
  Extension = "Extension",
}

export interface Notification {
  id: number;
  createdAt: string;
  type: NotificationType;
  platforms: PlatformType[];
  language: string;
  title: string;
  description: string;
  content: string;
  extensionImageUrl: string;
  mobileImageUrl: string;
  sourceUrl?: string;
  link?: {
    url: string;
    beforeLinkText: string;
    linkText: string;
    afterLinkText: string;
  }
}