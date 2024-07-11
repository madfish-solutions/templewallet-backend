import axios from 'axios';
import { readFile } from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import { redisClient } from '../redis';
import { CodedError } from './errors';
import { isDefined } from './helpers';
import logger from './logger';
import MutexProtectedData from './MutexProtectedData';
import SingleQueryDataProvider from './SingleQueryDataProvider';

type ResponseErrorBlock = [[string]];
type ResponseDataBlock = [string, string][];
type ResponseBlock = ResponseErrorBlock | ResponseDataBlock;
type ParsedCyrenApiErrorResponse = [ResponseDataBlock, ResponseErrorBlock];
type ParsedCyrenApiSuccessResponse = [ResponseDataBlock, ...ResponseDataBlock[]];
type ParsedCyrenApiResponse = ParsedCyrenApiErrorResponse | ParsedCyrenApiSuccessResponse;

interface SiteCategory {
  id: number;
  name: string;
  description: string;
}

const iniFileCategoryIdRegex = /^\[(\d+)\]/;
const iniFilePropertyRegex = /^(\w+)\s*=\s*(.+)/;

const isErrorResponse = (response: ParsedCyrenApiResponse): response is ParsedCyrenApiErrorResponse =>
  response[1][0].length === 1;

const secondlyRateLimiter = new RateLimiterMemory({
  points: 50,
  duration: 1,
  keyPrefix: 'secondlyRateLimiter'
});

const dailyRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'dailyRateLimiter',
  points: 5000,
  duration: 60 * 60 * 24
});

const cyrenApi = axios.create({
  baseURL: `${EnvVars.CTWSD_CONTAINER_ADDRESS}`,
  headers: {
    Accept: '*/*',
    'Accept-Language': 'en-us',
    'User-Agent': 'Cyren HTTP Client',
    'Content-Type': 'text/plain'
  }
});

const requestIdProxy = new MutexProtectedData(0);
const getRequestId = () =>
  requestIdProxy.exec((data, setData) => {
    setData((data + 1) % Number.MAX_SAFE_INTEGER);

    return data;
  });

const parseCyrenApiResponse = (response: string) => {
  const blocks: ResponseBlock[] = [];
  let currentBlock: ([string] | [string, string])[] = [];

  response.split('\n').forEach(line => {
    const trimmedLine = line.trim();

    if (trimmedLine === '' && currentBlock.length > 0) {
      blocks.push(currentBlock as ResponseDataBlock);
      currentBlock = [];
    } else if (trimmedLine.startsWith('x-ctch')) {
      const separatorIndex = trimmedLine.indexOf(':');
      const parsedBlockLine: [string, string] = [
        trimmedLine.slice(0, separatorIndex).trim(),
        trimmedLine.slice(separatorIndex + 1).trim()
      ];

      currentBlock.push(parsedBlockLine);
    } else {
      currentBlock.push([trimmedLine]);
    }
  });
  if (currentBlock.length > 0) {
    blocks.push(currentBlock as ResponseDataBlock);
  }

  return blocks as ParsedCyrenApiResponse;
};

const categoriesProvider = new SingleQueryDataProvider(Infinity, async () => {
  const response = await cyrenApi.post<string>(
    '/ctwsd/websec',
    `x-ctch-request-id: ${await getRequestId()}
x-ctch-request-type: getcatlist
x-ctch-pver: 1.0
`
  );
  const parsedResponse = parseCyrenApiResponse(response.data);

  if (isErrorResponse(parsedResponse)) {
    throw new Error(`Failed to fetch categories: ${parsedResponse[1][0]}`);
  }

  // TODO: use the block with custom categories and remove parsing ini file after they are fixed
  const [, defaultCategoriesBlock] = parsedResponse;
  const [counterLine, ...restLines] = defaultCategoriesBlock;

  const categoriesCount = Number.parseInt(counterLine[1]);

  const categories: SiteCategory[] = [];
  for (let i = 0; i < categoriesCount; i++) {
    const category = {
      id: 0,
      name: '',
      description: ''
    };
    const dataLines = restLines.slice(i * 3, (i + 1) * 3);
    dataLines.forEach(([name, value]) => {
      switch (name) {
        case 'x-ctch-cat-id':
          category.id = Number.parseInt(value);
          break;
        case 'x-ctch-cat-name':
          category.name = value;
          break;
        default:
          category.description = value;
      }
    });
    categories.push(category);
  }

  const defaultCategories = Object.fromEntries(categories.map(category => [category.id, category]));

  const rawCustomCategoryDefinitions = await readFile(
    path.resolve(__dirname, '../../ctwsd-config/CustomCategoryDefinition.ini'),
    { encoding: 'utf-8' }
  );
  const customCategories: Record<number, SiteCategory> = {};
  let nextCategory: SiteCategory = {
    id: -1,
    name: '',
    description: ''
  };
  rawCustomCategoryDefinitions.split('\n').forEach(line => {
    const trimmedLine = line.trim();

    if (trimmedLine === '' && nextCategory.id !== -1 && nextCategory.name !== '') {
      customCategories[nextCategory.id] = nextCategory;
      nextCategory = {
        id: -1,
        name: '',
        description: ''
      };

      return;
    }

    const categoryIdExecResult = iniFileCategoryIdRegex.exec(trimmedLine);
    if (isDefined(categoryIdExecResult)) {
      nextCategory.id = Number.parseInt(categoryIdExecResult[1]);

      return;
    }

    const propertyExecResult = iniFilePropertyRegex.exec(trimmedLine);
    if (propertyExecResult) {
      switch (propertyExecResult[1]) {
        case 'Name':
          nextCategory.name = propertyExecResult[2];
          break;
        case 'Description':
          nextCategory.description = propertyExecResult[2];
          break;
        default:
          logger.warn(`Unknown property in custom category definition: ${propertyExecResult[1]}`);
      }
    }
  });
  if (nextCategory.id !== -1 && nextCategory.name !== '') {
    customCategories[nextCategory.id] = nextCategory;
  }

  return { defaultCategories, customCategories };
});

export const getSiteCategories = async (url: string) => {
  // TODO: remove this after the issue with HTTPS URLs is fixed
  if (url.startsWith('https://')) {
    url = url.slice(8);
  }

  const { data: categories, error } = await categoriesProvider.getState();

  if (error) {
    throw error;
  }

  try {
    await secondlyRateLimiter.consume('twbackend', 1);
    await dailyRateLimiter.consume('twbackend', 1);

    const response = await cyrenApi.post<string>(
      '/ctwsd/websec',
      `x-ctch-request-id: ${await getRequestId()}
x-ctch-request-type: classifyurl
x-ctch-pver: 1.0

x-ctch-url: ${url}`
    );
    const parsedResponse = parseCyrenApiResponse(response.data);

    if (isErrorResponse(parsedResponse)) {
      throw new Error(`Failed to classify URL: ${parsedResponse[1][0]}`);
    }

    const { defaultCategories, customCategories } = categories;
    const [, categoriesBlock] = parsedResponse;
    const siteCategories: string[] = [];
    let cacheWasUsed = true;

    categoriesBlock.forEach(([name, value]) => {
      switch (name) {
        case 'x-ctch-categories':
          siteCategories.push(
            ...value
              .split(',')
              .map(categoryId => defaultCategories[categoryId]?.name)
              .filter(Boolean)
          );
          break;
        case 'x-ctch-flags':
          cacheWasUsed = Number.parseInt(value) % 2 === 0;
          break;
        default:
          siteCategories.push(
            ...value
              .split(',')
              .map(categoryId => customCategories[categoryId]?.name)
              .filter(Boolean)
          );
      }
    });

    if (cacheWasUsed) {
      await secondlyRateLimiter.reward('twbackend', 1);
      await dailyRateLimiter.reward('twbackend', 1);
    }

    return siteCategories;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }

    throw new CodedError(StatusCodes.TOO_MANY_REQUESTS, 'Too Many Requests');
  }
};
