import logger from "../../utils/logger";
import { SortedBy } from "../notifications.interface";
import { mockData } from "./activity-notifications.data";
import { ActivityNotification, ActivityType } from "./activity-notifications.interface";

export interface ActivityNotificationsProps {
  type?: ActivityType | 'all';
  limit?: string;
  page?: string;
  timeLt?: string;
  timeGt?: string;
  sorted?: SortedBy;
}

const defaults = {
  type: 'all',
  limit: '50',
  page: '1',
  timeLt: Number.MAX_SAFE_INTEGER.toString(),
  timeGt: '0',
  sorted: SortedBy.DateDesc
}

export const getActivityNotifications = async (newsProps: ActivityNotificationsProps) => {
  logger.info(`Getting Activity`);
  return await activityController(newsProps);
};

export const getActivityNotificationsCount = async (newsProps: ActivityNotificationsProps) => {
  logger.info(`Getting Activity Count`);
  const count = (await activityController(newsProps)).length;
  return { count }
};

const activityController = async (newsProps: ActivityNotificationsProps) => {
  const {
    type = defaults.type,
    limit = defaults.limit,
    page = defaults.page,
    timeLt = defaults.timeLt,
    timeGt = defaults.timeGt,
    sorted = defaults.sorted
  } = newsProps;
  const originalList = mockData;
  const filteredList = filterActivities(originalList, type, limit, page, timeLt, timeGt, sorted);
  return filteredList;
};

const filterActivities = (
  activities: Array<ActivityNotification>,
  type: string,
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

  const sortedList = activities
  .sort((a, b) => sorted !== SortedBy.DateAsc
    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const filteredList = sortedList
    .filter(n => n.type.toString() === type || type === 'all')
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
