import { redisClient } from '../redis';
import { isDefined } from '../utils/helpers';

export interface SliseAdContainerRule {
  urlRegexes: string[];
  selector: {
    isMultiple: boolean;
    cssString: string;
    shouldUseResultParent: boolean;
  };
}

const SLISE_AD_CONTAINERS_RULES_KEY = 'slise_ad_containers_rules';
const SLISE_HEURISTIC_URL_REGEXES_KEY = 'slise_heuristic_url_regexes_key';
const SLISE_HEURISTIC_SELECTORS_KEY = 'slise_heuristic_selectors_key';

const objectStorageMethodsFactory = <V>(storageKey: string, fallbackValue: V) => ({
  getByKey: async (key: string): Promise<V> => {
    const value = await redisClient.hget(storageKey, key);

    return isDefined(value) ? JSON.parse(value) : fallbackValue;
  },
  getAllValues: async (): Promise<Record<string, V>> => {
    const values = await redisClient.hgetall(storageKey);

    const parsedValues: Record<string, V> = {};
    for (const key in values) {
      parsedValues[key] = JSON.parse(values[key]);
    }

    return parsedValues;
  },
  upsertValues: (newValues: Record<string, V>) =>
    redisClient.hmset(
      storageKey,
      Object.fromEntries(Object.entries(newValues).map(([domain, value]) => [domain, JSON.stringify(value)]))
    ),
  removeValues: (keys: string[]) => redisClient.hdel(storageKey, ...keys)
});

export const {
  getByKey: getSliseAdContainerRulesByDomain,
  getAllValues: getAllSliseAdContainerRules,
  upsertValues: upsertSliseAdContainerRules,
  removeValues: removeSliseAdContainerRules
} = objectStorageMethodsFactory<SliseAdContainerRule[]>(SLISE_AD_CONTAINERS_RULES_KEY, []);

export const {
  getByKey: getSliseHeuristicSelectorsByAdType,
  getAllValues: getAllSliseHeuristicSelectors,
  upsertValues: upsertSliseHeuristicSelectors,
  removeValues: removeSliseHeuristicSelectors
} = objectStorageMethodsFactory<string[]>(SLISE_HEURISTIC_SELECTORS_KEY, []);

export const getSliseHeuristicUrlRegexes = async () => redisClient.smembers(SLISE_HEURISTIC_URL_REGEXES_KEY);

export const addSliseHeuristicUrlRegexes = async (regexes: string[]) =>
  redisClient.sadd(SLISE_HEURISTIC_URL_REGEXES_KEY, ...regexes);

export const removeSliseHeuristicUrlRegexes = async (regexes: string[]) =>
  redisClient.srem(SLISE_HEURISTIC_URL_REGEXES_KEY, ...regexes);
