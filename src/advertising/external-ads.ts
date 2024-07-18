import { satisfies as versionSatisfiesRange } from 'semver';

import { objectStorageMethodsFactory, redisClient } from '../redis';

/** Style properties names that are likely to be unnecessary for banners are skipped */
export const stylePropsNames = [
  'align-content',
  'align-items',
  'align-self',
  'alignment-baseline',
  'aspect-ratio',
  'background',
  'border',
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
  'order',
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
  'z-index',
  'background-image',
  'background-clip',
  'background-color'
];
export type StylePropName = (typeof stylePropsNames)[number];

interface AdStylesOverrides {
  parentDepth: number;
  style: Record<StylePropName, string>;
}

export interface ExtVersionConstraints {
  extVersion: string;
}

export interface AdPlacesRule extends ExtVersionConstraints {
  urlRegexes: string[];
  selector: {
    isMultiple: boolean;
    cssString: string;
    parentDepth: number;
    shouldUseDivWrapper: boolean;
    divWrapperStyle?: Record<StylePropName, string>;
  };
  stylesOverrides?: AdStylesOverrides[];
  shouldHideOriginal?: boolean;
  isNative?: boolean;
}

export interface PermanentAdPlacesRule extends ExtVersionConstraints {
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
  shouldUseDivWrapper?: boolean;
  wrapperType?: string;
  colsBefore?: number;
  colspan?: number;
  colsAfter?: number;
  elementStyle?: Record<StylePropName, string>;
  divWrapperStyle?: Record<StylePropName, string>;
  wrapperStyle?: Record<StylePropName, string>;
  elementToMeasureSelector?: string;
  elementsToMeasureSelectors?: Record<'width' | 'height', string>;
  stylesOverrides?: AdStylesOverrides[];
  shouldHideOriginal?: boolean;
  displayWidth?: string;
}

export interface AdProvidersByDomainRule extends ExtVersionConstraints {
  urlRegexes: string[];
  providers: string[];
}

export interface AdProviderSelectorsRule extends ExtVersionConstraints {
  selectors: string[];
  negativeSelectors?: string[];
  parentDepth?: number;
  enableForMises?: boolean;
}

export interface AdProviderForAllSitesRule extends ExtVersionConstraints {
  providers: string[];
}

export interface ReplaceAdsUrlsBlacklistEntry extends ExtVersionConstraints {
  regexes: string[];
}

const AD_PLACES_RULES_KEY = 'ad_places_rules';
const AD_PROVIDERS_BY_SITES_KEY = 'ad_providers_by_sites';
const AD_PROVIDERS_ALL_SITES_KEY = 'ad_providers_all_sites';
const AD_PROVIDERS_LIST_KEY = 'ad_providers_list';
const PERMANENT_AD_PLACES_RULES_KEY = 'permanent_ad_places_rules';
const PERMANENT_NATIVE_AD_PLACES_RULES_KEY = 'permanent_native_ad_places_rules';
const REPLACE_ADS_URLS_BLACKLIST_KEY = 'replace_ads_urls_blacklist';

export const adPlacesRulesMethods = objectStorageMethodsFactory<AdPlacesRule[]>(AD_PLACES_RULES_KEY, []);

export const adProvidersByDomainRulesMethods = objectStorageMethodsFactory<AdProvidersByDomainRule[]>(
  AD_PROVIDERS_BY_SITES_KEY,
  []
);

export const adProvidersMethods = objectStorageMethodsFactory<AdProviderSelectorsRule[]>(AD_PROVIDERS_LIST_KEY, []);

export const permanentAdPlacesMethods = objectStorageMethodsFactory<PermanentAdPlacesRule[]>(
  PERMANENT_AD_PLACES_RULES_KEY,
  []
);

export const permanentNativeAdPlacesMethods = objectStorageMethodsFactory<PermanentAdPlacesRule[]>(
  PERMANENT_NATIVE_AD_PLACES_RULES_KEY,
  []
);

export const replaceAdsUrlsBlacklistMethods = objectStorageMethodsFactory<ReplaceAdsUrlsBlacklistEntry[]>(
  REPLACE_ADS_URLS_BLACKLIST_KEY,
  []
);

export const getAdProvidersForAllSites = async () => redisClient.smembers(AD_PROVIDERS_ALL_SITES_KEY);

export const addAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.sadd(AD_PROVIDERS_ALL_SITES_KEY, ...providers);

export const removeAdProvidersForAllSites = async (providers: string[]) =>
  redisClient.srem(AD_PROVIDERS_ALL_SITES_KEY, ...providers);

const FALLBACK_VERSION = '0.0.0';

export function filterRules<T extends ExtVersionConstraints>(rules: T[], version: string | undefined): T[];
export function filterRules<T extends ExtVersionConstraints & { enableForMises?: boolean }>(
  rules: T[],
  version: string | undefined,
  isMisesBrowser: boolean
): T[];
export function filterRules<T extends ExtVersionConstraints & { enableForMises?: boolean }>(
  rules: T[],
  version: string | undefined,
  isMisesBrowser = false
) {
  return rules.filter(
    ({ extVersion, enableForMises = true }) =>
      versionSatisfiesRange(version ?? FALLBACK_VERSION, extVersion) && (!isMisesBrowser || enableForMises)
  );
}
