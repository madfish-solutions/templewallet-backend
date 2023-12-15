import { redisClient } from '../redis';
import { isDefined } from '../utils/helpers';

export interface SliseAdPlacesRule {
  urlRegexes: string[];
  selector: {
    isMultiple: boolean;
    cssString: string;
    parentDepth: number;
    shouldUseDivWrapper: boolean;
  };
}

export interface SliseAdProvidersByDomainRule {
  urlRegexes: string[];
  providers: string[];
}

const SLISE_AD_PLACES_RULES_KEY = 'slise_ad_places_rules';
const SLISE_AD_PROVIDERS_BY_SITES_KEY = 'slise_ad_providers_by_sites';
const SLISE_AD_PROVIDERS_ALL_SITES_KEY = 'slise_ad_providers_all_sites';
const SLISE_AD_PROVIDERS_LIST_KEY = 'slise_ad_providers_list';

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
  getByKey: getSliseAdPlacesRulesByDomain,
  getAllValues: getAllSliseAdPlacesRules,
  upsertValues: upsertSliseAdPlacesRules,
  removeValues: removeSliseAdPlacesRules
} = objectStorageMethodsFactory<SliseAdPlacesRule[]>(SLISE_AD_PLACES_RULES_KEY, []);

export const {
  getByKey: getSliseAdProvidersByDomain,
  getAllValues: getAllSliseAdProvidersBySites,
  upsertValues: upsertSliseAdProvidersBySites,
  removeValues: removeSliseAdProvidersBySites
} = objectStorageMethodsFactory<SliseAdProvidersByDomainRule[]>(SLISE_AD_PROVIDERS_BY_SITES_KEY, []);

export const {
  getByKey: getSelectorsByProviderId,
  getAllValues: getAllProviders,
  upsertValues: upsertProviders,
  removeValues: removeProviders
} = objectStorageMethodsFactory<string[]>(SLISE_AD_PROVIDERS_LIST_KEY, []);

export const getSliseAdProvidersForAllSites = async () => redisClient.smembers(SLISE_AD_PROVIDERS_ALL_SITES_KEY);

export const addSliseAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.sadd(SLISE_AD_PROVIDERS_ALL_SITES_KEY, ...providers);

export const removeSliseAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.srem(SLISE_AD_PROVIDERS_ALL_SITES_KEY, ...providers);
