import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

import { EnvVars } from '../config';
import { redisClient } from '../redis';
import { CodedError } from './errors';
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
  let remainingLines = response.split('\n').map(line => line.trim());
  const blocks: ResponseBlock[] = [];
  while (remainingLines.length > 0) {
    const emptyLineIndex = remainingLines.indexOf('');
    const blockLines = emptyLineIndex === -1 ? remainingLines : remainingLines.slice(0, emptyLineIndex);
    const block = blockLines.map((line): [string] | [string, string] => {
      if (line.startsWith('x-ctch')) {
        const separatorIndex = line.indexOf(':');

        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }

      return [line];
    }) as ResponseBlock;
    if (block.length > 0) {
      blocks.push(block);
    }
    remainingLines = emptyLineIndex === -1 ? [] : remainingLines.slice(emptyLineIndex + 1);
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

  const [, defaultCategoriesBlock, customCategoriesBlock = [['x-ctch-custom-cat-count', '0']]] = parsedResponse;

  const [defaultCategories, customCategories] = [defaultCategoriesBlock, customCategoriesBlock].map(
    ([counterLine, ...restLines]) => {
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

      return Object.fromEntries(categories.map(category => [category.id, category]));
    }
  );

  return { defaultCategories, customCategories };
});

export const getSiteCategories = async (url: string) => {
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
