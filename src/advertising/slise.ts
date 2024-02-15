import { objectStorageMethodsFactory, redisClient } from '../redis';

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
  'vertical-align',
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

export interface PermanentSliseAdPlacesRule {
  urlRegexes: string[];
  adSelector: {
    isMultiple: boolean;
    cssString: string;
    parentDepth: number;
  };
  parentSelector: {
    isMultiple: boolean;
    cssString: string;
    parentDepth: number;
  };
  insertionIndex?: number;
  insertBeforeSelector?: string;
  insertAfterSelector?: string;
  insertionsCount?: number;
  shouldUseDivWrapper: boolean;
  elementStyle?: Record<StylePropName, string>;
  divWrapperStyle?: Record<StylePropName, string>;
  elementToMeasureSelector?: string;
  stylesOverrides?: SliseAdStylesOverrides[];
  shouldHideOriginal?: boolean;
}

export interface SliseAdProvidersByDomainRule {
  urlRegexes: string[];
  providers: string[];
}

const SLISE_AD_PLACES_RULES_KEY = 'slise_ad_places_rules';
const SLISE_AD_PROVIDERS_BY_SITES_KEY = 'slise_ad_providers_by_sites';
const SLISE_AD_PROVIDERS_ALL_SITES_KEY = 'slise_ad_providers_all_sites';
const SLISE_AD_PROVIDERS_LIST_KEY = 'slise_ad_providers_list';
const PERMANENT_SLISE_AD_PLACES_RULES_KEY = 'permanent_slise_ad_places_rules';
const PERMANENT_NATIVE_AD_PLACES_RULES_KEY = 'permanent_native_ad_places_rules';

export const sliseAdPlacesRulesMethods = objectStorageMethodsFactory<SliseAdPlacesRule[]>(
  SLISE_AD_PLACES_RULES_KEY,
  []
);

export const sliseAdProvidersByDomainRulesMethods = objectStorageMethodsFactory<SliseAdProvidersByDomainRule[]>(
  SLISE_AD_PROVIDERS_BY_SITES_KEY,
  []
);

export const sliseAdProvidersMethods = objectStorageMethodsFactory<string[]>(SLISE_AD_PROVIDERS_LIST_KEY, []);

export const permanentSliseAdPlacesMethods = objectStorageMethodsFactory<PermanentSliseAdPlacesRule[]>(
  PERMANENT_SLISE_AD_PLACES_RULES_KEY,
  []
);

export const permanentNativeAdPlacesMethods = objectStorageMethodsFactory<PermanentSliseAdPlacesRule[]>(
  PERMANENT_NATIVE_AD_PLACES_RULES_KEY,
  []
);

export const getSliseAdProvidersForAllSites = async () => redisClient.smembers(SLISE_AD_PROVIDERS_ALL_SITES_KEY);

export const addSliseAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.sadd(SLISE_AD_PROVIDERS_ALL_SITES_KEY, ...providers);

export const removeSliseAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.srem(SLISE_AD_PROVIDERS_ALL_SITES_KEY, ...providers);
