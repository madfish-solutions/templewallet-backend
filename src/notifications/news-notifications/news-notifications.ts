import logger from "../../utils/logger";
import { SortedBy } from "../notifications.interface";
import { mockData, mockWelcomeData } from "./news-notifications.data";
import { NewsNotification, PlatformType } from "./news-notifications.interface";

export interface NewsNotificationsProps {
  welcome?: boolean;
  platform?: PlatformType;
  limit?: string;
  page?: string;
  timeLt?: string;
  timeGt?: string;
  sorted?: SortedBy;
}

const defaults = {
  welcome: false,
  platform: PlatformType.Extension,
  limit: '50',
  page: '1',
  timeLt: Number.MAX_SAFE_INTEGER.toString(),
  timeGt: '0',
  sorted: SortedBy.DateDesc
}

export const getNewsNotifications = async (newsProps: NewsNotificationsProps) => {
  logger.info(`Getting News`);
  return await newsController(newsProps);
};

export const getNewsNotificationsCount = async (newsProps: NewsNotificationsProps) => {
  logger.info(`Getting News Count`);
  const count = (await newsController(newsProps)).length;
  return { count }
};

const newsController = async (newsProps: NewsNotificationsProps) => {
  const {
    welcome = defaults.welcome,
    platform = defaults.platform,
    limit = defaults.limit,
    page = defaults.page,
    timeLt = defaults.timeLt,
    timeGt = defaults.timeGt,
    sorted = defaults.sorted
  } = newsProps;
  const originalList = welcome ? mockWelcomeData : mockData;
  const filteredList = filterNews(originalList, platform, limit, page, timeLt, timeGt, sorted);
  return filteredList;
};

const filterNews = (
  news: Array<NewsNotification>,
  platform: PlatformType,
  limit: string,
  page: string,
  lt: string,
  gt: string,
  sorted: SortedBy
) => {
  const guardLimit = Number(limit) < 10 || typeof limit !== 'string' ? 10 : Number(limit);
  const guardPage = Number(page) < 1 || typeof page !== 'string' ? 1 : Number(page);
  const guardlt = Number(lt) > Number.MAX_SAFE_INTEGER || typeof lt !== 'string' ? Number.MAX_SAFE_INTEGER : Number(lt);
  const guardgt = Number(gt) < 0 || typeof gt !== 'string' ? 0 : Number(gt);

  const sortedList = news
  .sort((a, b) => sorted !== SortedBy.DateAsc
    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const filteredList = sortedList
    .filter(n => n.platform === platform)
    .filter(n => new Date(n.createdAt).getTime() < guardlt)
    .filter(n => new Date(n.createdAt).getTime() > guardgt);

  const slicedList = sliceIntoChunks(filteredList, guardLimit);

  return slicedList.length >= guardPage ? slicedList[guardPage - 1] : [];
}

const sliceIntoChunks = <T>(array: T[], chunkSize: number) => {
  const result: Array<T[]> = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result.push(chunk);
  }

  return result;
};
