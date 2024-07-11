import axios, { AxiosError } from 'axios';

import { EnvVars } from '../config';
import PromisifiedSemaphore from './PromisifiedSemaphore';

export type ItemStatus = 'processed' | 'pending' | 'failed';

interface InsertItemResponse {
  id: string;
}

interface ItemCategory {
  id: string;
  name: string;
  pathName: string;
  itemCount: number;
}

interface ItemCategoriesResponse {
  categories: ItemCategory[];
}

export interface ItemResponse {
  id: string;
  catGroupId: string;
  extId: string;
  status: ItemStatus;
  manualTitle: string;
  content: string;
  created: string;
}

const categoraizeApi = axios.create({
  baseURL: 'https://categoraize.io/api/v1',
  headers: {
    Authorization: `Bearer ${EnvVars.CATEGORAIZE_API_KEY}`
  }
});
const apiSemaphore = new PromisifiedSemaphore(5);

export const insertItem = (extId: string, content: string) =>
  apiSemaphore.exec(async () => {
    const response = await categoraizeApi.post<InsertItemResponse>(
      `/category-groups/${EnvVars.CATEGORAIZE_CATEGORY_GROUP_ID}/items`,
      {
        extId,
        manualTitle: extId,
        content,
        attachments: []
      }
    );

    return response.data.id;
  });

export const getItem = (id: string) =>
  apiSemaphore.exec(async () => {
    try {
      const response = await categoraizeApi.get<ItemResponse>(`/items/${id}`);

      return response.data;
    } catch (e) {
      if (e instanceof AxiosError && e.response?.status === 404) {
        return null;
      }

      throw e;
    }
  });

export const getItemCategory = (id: string) =>
  apiSemaphore.exec<string | undefined>(async () => {
    const response = await categoraizeApi.get<ItemCategoriesResponse>(`/items/${id}/categories`);

    return response.data.categories[0]?.name;
  });
