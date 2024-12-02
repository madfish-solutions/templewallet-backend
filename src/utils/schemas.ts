import { getAddress } from '@ethersproject/address';
import { validRange as getValidatedRange } from 'semver';
import {
  array as arraySchema,
  ArraySchema as IArraySchema,
  boolean as booleanSchema,
  number as numberSchema,
  object as objectSchema,
  ObjectSchema as IObjectSchema,
  Schema,
  string as stringSchema,
  StringSchema as IStringSchema
} from 'yup';

import {
  AdPlacesRule,
  PermanentAdPlacesRule,
  AdProvidersByDomainRule,
  StylePropName,
  stylePropsNames,
  AdProviderSelectorsRule,
  ReplaceAdsUrlsBlacklistEntry,
  ElementsToHideOrRemoveEntry
} from '../advertising/external-ads';
import { isValidSelectorsGroup } from '../utils/selectors.min.js';

import { isDefined } from './helpers';

type nullish = null | undefined;

const makeDictionarySchema = <T>(keySchema: IStringSchema, valueSchema: Schema<T>) =>
  objectSchema()
    .test('keys-are-valid', async (value: object | nullish) => {
      if (!isDefined(value)) {
        return true;
      }

      await Promise.all(Object.keys(value).map(key => keySchema.validate(key)));

      return true;
    })
    .test('values-are-valid', async (value: object | nullish) => {
      if (!isDefined(value)) {
        return true;
      }

      await Promise.all(Object.values(value).map(value => valueSchema.validate(value)));

      return true;
    }) as IObjectSchema<Record<string, T>>;

const regexStringSchema = stringSchema().test('is-regex', function (value: string | undefined) {
  try {
    if (!isDefined(value)) {
      return true;
    }

    new RegExp(value);

    return true;
  } catch (e) {
    throw this.createError({ path: this.path, message: `${value} must be a valid regex string` });
  }
});

export const regexStringListSchema = arraySchema().of(regexStringSchema.clone().required());

const versionRangeSchema = stringSchema().test('is-version-range', function (value: string | undefined) {
  return !isDefined(value) || isDefined(getValidatedRange(value));
});

const cssSelectorSchema = stringSchema().test('is-css-selector', function (value: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!isDefined(value) || isValidSelectorsGroup(value)) {
    return true;
  }

  throw this.createError({ path: this.path, message: `${value} must be a valid CSS selector` });
});

const cssSelectorsListSchema = arraySchema().of(cssSelectorSchema.clone().required());

const hostnameSchema = stringSchema().matches(
  /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$/,
  params => `${params.value} is an invalid hostname`
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hostnamesListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(hostnameSchema.clone().required())
  .required();

const nonEmptyStringSchema = stringSchema().min(1);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nonEmptyStringsListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(nonEmptyStringSchema.clone().required())
  .min(1)
  .required()
  .typeError('Must be a non-empty array');

const styleSchema: IObjectSchema<Record<StylePropName, string>> = makeDictionarySchema(
  stringSchema()
    .oneOf<StylePropName>(stylePropsNames, params => `${params.value} is an unknown style property`)
    .required(),
  stringSchema().required()
);

const adStylesOverridesSchema = objectSchema().shape({
  parentDepth: numberSchema().integer().min(0).required(),
  style: styleSchema.clone().required()
});

export const evmQueryParamsSchema = objectSchema().shape({
  walletAddress: nonEmptyStringSchema.clone().required('walletAddress is undefined'),
  chainId: nonEmptyStringSchema.clone().required('chainId is undefined')
});

export const evmQueryParamsPaginatedSchema = evmQueryParamsSchema.clone().shape({
  page: numberSchema().integer().min(1)
});

export const evmQueryParamsTransactionsSchema = objectSchema().shape({
  chainId: numberSchema().integer().min(1).required('chainId is undefined'),
  walletAddress: nonEmptyStringSchema.clone().required('walletAddress is undefined'),
  /** Without token ID means ERC-20 tokens only */
  contractAddress: nonEmptyStringSchema.clone(),
  olderThanBlockHeight: nonEmptyStringSchema.clone().test(v => v === undefined || Number(v) > 0)
});

export const evmQueryParamsTransfersSchema = evmQueryParamsPaginatedSchema.clone().shape({
  contractAddress: stringSchema()
    .required()
    .test(val => getAddress(val) === val)
});

const adPlacesRulesSchema = arraySchema()
  .of(
    objectSchema()
      .shape({
        urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
        selector: objectSchema()
          .shape({
            isMultiple: booleanSchema().required(),
            cssString: cssSelectorSchema.clone().required(),
            parentDepth: numberSchema().integer().min(0).required(),
            shouldUseDivWrapper: booleanSchema().required(),
            divWrapperStyle: styleSchema
          })
          .required(),
        stylesOverrides: arraySchema().of(adStylesOverridesSchema.clone().required()),
        shouldHideOriginal: booleanSchema(),
        isNative: booleanSchema(),
        extVersion: versionRangeSchema.clone().required()
      })
      .required()
  )
  .required();

export const adPlacesRulesDictionarySchema: IObjectSchema<Record<string, AdPlacesRule[]>> = makeDictionarySchema(
  hostnameSchema,
  adPlacesRulesSchema
).required();

const permanentAdPlacesRuleSchema: IObjectSchema<PermanentAdPlacesRule> = objectSchema()
  .shape({
    urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
    adSelector: objectSchema()
      .shape({
        isMultiple: booleanSchema().required(),
        cssString: cssSelectorSchema.clone().required(),
        parentDepth: numberSchema().integer().min(0).required()
      })
      .required(),
    parentSelector: objectSchema()
      .shape({
        isMultiple: booleanSchema().required(),
        cssString: cssSelectorSchema.clone().required(),
        parentDepth: numberSchema().integer().min(0).required()
      })
      .required(),
    insertionIndex: numberSchema().integer(),
    insertBeforeSelector: cssSelectorSchema,
    insertAfterSelector: cssSelectorSchema,
    insertionsCount: numberSchema().integer().min(1),
    shouldUseDivWrapper: booleanSchema(),
    wrapperType: stringSchema().oneOf(['div', 'tbody']),
    colsBefore: numberSchema().integer().min(0),
    colspan: numberSchema().integer().min(1),
    colsAfter: numberSchema().integer().min(0),
    elementStyle: styleSchema,
    divWrapperStyle: styleSchema,
    wrapperStyle: styleSchema,
    elementToMeasureSelector: cssSelectorSchema,
    elementsToMeasureSelectors: objectSchema()
      .shape({ width: cssSelectorSchema.clone(), height: cssSelectorSchema.clone() })
      .test('all-fields-present', function (value: unknown) {
        if (!value || typeof value !== 'object') {
          return true;
        }

        if (typeof (value as any).width === 'string' && typeof (value as any).height === 'string') {
          return true;
        }

        throw this.createError({ path: this.path, message: 'Both `width` and `height` fields must be specified' });
      })
      .default(undefined) as unknown as IObjectSchema<{ width: string; height: string } | undefined>,
    stylesOverrides: arraySchema().of(adStylesOverridesSchema.clone().required()),
    shouldHideOriginal: booleanSchema(),
    extVersion: versionRangeSchema.clone().required(),
    displayWidth: versionRangeSchema.clone().test('valid-boundary-values', (value: string | undefined) => {
      if (!isDefined(value) || value.length === 0) {
        return true;
      }

      const nonIntegerNumberMatches = value.match(/\d+\.\d+/g);
      if (isDefined(nonIntegerNumberMatches)) {
        throw new Error('Display width must be an integer');
      }

      return true;
    }),
    supportsTheming: booleanSchema().default(false),
    fontSampleSelector: cssSelectorSchema.clone(),
    enableForMises: booleanSchema().default(true),
    enableForNonMises: booleanSchema().default(true)
  })
  .test('insertion-place-specified', (value: PermanentAdPlacesRule | undefined) => {
    if (!value) {
      return true;
    }

    const { insertionIndex, insertBeforeSelector, insertAfterSelector } = value;
    const definedValuesCount = [insertionIndex, insertBeforeSelector, insertAfterSelector].filter(isDefined).length;

    if (definedValuesCount !== 1) {
      throw new Error('Exactly one of insertionIndex, insertBeforeSelector and insertAfterSelector must be specified');
    }

    return true;
  })
  .required();

export const permanentAdPlacesRulesDictionarySchema: IObjectSchema<Record<string, PermanentAdPlacesRule[]>> =
  makeDictionarySchema(
    hostnameSchema,
    arraySchema().of(permanentAdPlacesRuleSchema.clone().required()).required()
  ).required();

const adProvidersByDomainRulesSchema = arraySchema()
  .of(
    objectSchema()
      .shape({
        urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
        providers: arraySchema().of(stringSchema().required()).required(),
        extVersion: versionRangeSchema.clone().required()
      })
      .required()
  )
  .required();

export const adProvidersByDomainsRulesDictionarySchema: IObjectSchema<Record<string, AdProvidersByDomainRule[]>> =
  makeDictionarySchema(hostnameSchema, adProvidersByDomainRulesSchema).required();

const adProvidersSelectorsRuleSchema: IObjectSchema<AdProviderSelectorsRule> = objectSchema().shape({
  selectors: cssSelectorsListSchema.clone().required(),
  negativeSelectors: cssSelectorsListSchema.clone(),
  extVersion: versionRangeSchema.clone().required(),
  parentDepth: numberSchema().integer().min(0).default(0),
  enableForMises: booleanSchema().default(true),
  enableForNonMises: booleanSchema().default(true)
});

export const adProvidersDictionarySchema = makeDictionarySchema<AdProviderSelectorsRule[]>(
  nonEmptyStringSchema.clone().required(),
  arraySchema().of(adProvidersSelectorsRuleSchema.clone().required()).required()
).required();

const replaceUrlsBlacklistEntrySchema: IObjectSchema<ReplaceAdsUrlsBlacklistEntry> = objectSchema().shape({
  extVersion: versionRangeSchema.clone().required(),
  regexes: regexStringListSchema.clone().required()
});

export const replaceUrlsBlacklistDictionarySchema = makeDictionarySchema<ReplaceAdsUrlsBlacklistEntry[]>(
  nonEmptyStringSchema.clone().required(),
  arraySchema().of(replaceUrlsBlacklistEntrySchema.clone().required()).required()
).required();

const elementsToHideOrRemoveEntrySchema = objectSchema().shape({
  extVersion: versionRangeSchema.clone().required(),
  cssString: cssSelectorSchema.clone().required(),
  parentDepth: numberSchema().integer().min(0).required(),
  isMultiple: booleanSchema().required(),
  urlRegexes: regexStringListSchema.clone().required(),
  shouldHide: booleanSchema().required()
});

export const elementsToHideOrRemoveDictionarySchema = makeDictionarySchema<ElementsToHideOrRemoveEntry[]>(
  hostnameSchema.clone().required(),
  arraySchema().of(elementsToHideOrRemoveEntrySchema.clone().required()).required()
).required();

export const adProvidersCategoriesDictionarySchema = makeDictionarySchema<string[]>(
  nonEmptyStringSchema.clone().required(),
  arraySchema().of(nonEmptyStringSchema.clone().required()).required()
).required();
