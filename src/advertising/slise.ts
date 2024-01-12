import { redisClient } from '../redis';
import { isDefined } from '../utils/helpers';

/** Style properties names that are likely to be unnecessary for banners are skipped */
export const stylePropsNames = [
  'align-content',
  'align-items',
  'align-self',
  'alignment-baseline',
  'aspect-ratio',
  'background',
  'border-radius',
  'bottom',
  'box-shadow',
  'box-sizing',
  'display',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'float',
  'height',
  'justify-content',
  'justify-items',
  'justify-self',
  'left',
  'margin',
  'margin-block',
  'margin-block-end',
  'margin-block-start',
  'margin-bottom',
  'margin-inline',
  'margin-inline-end',
  'margin-inline-start',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-block-size',
  'max-height',
  'max-inline-size',
  'max-width',
  'min-block-size',
  'min-height',
  'min-inline-size',
  'min-width',
  'opacity',
  'overflow',
  'overflow-anchor',
  'overflow-wrap',
  'overflow-x',
  'overflow-y',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-inline',
  'padding-inline-end',
  'padding-inline-start',
  'padding-left',
  'padding-right',
  'padding-top',
  'position',
  'right',
  'text-align',
  'top',
  'visibility',
  'width',
  'z-index'
];
export type StylePropName = (typeof stylePropsNames)[number];

interface SliseAdStylesOverrides {
  parentDepth: number;
  style: Record<StylePropName, string>;
}

export interface SliseAdPlacesRule {
  urlRegexes: string[];
  selector: {
    isMultiple: boolean;
    cssString: string;
    parentDepth: number;
    shouldUseDivWrapper: boolean;
    divWrapperStyle?: Record<StylePropName, string>;
  };
  stylesOverrides?: SliseAdStylesOverrides[];
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
