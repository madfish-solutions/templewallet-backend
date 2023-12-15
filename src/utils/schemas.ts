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

import { SliseAdPlacesRule, SliseAdProvidersByDomainRule } from '../advertising/slise';
import { isValidSelectorsGroup } from '../utils/selectors.min.js';
import { isDefined } from './helpers';

const regexStringSchema = stringSchema().test('is-regex', function (value: string | undefined) {
  try {
    if (!isDefined(value)) {
      throw new Error();
    }

    new RegExp(value);

    return true;
  } catch (e) {
    throw this.createError({ path: this.path, message: `${value} must be a valid regex string` });
  }
});

export const regexStringListSchema = arraySchema().of(regexStringSchema.clone().required());

const cssSelectorSchema = stringSchema().test('is-css-selector', function (value: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (isDefined(value) && isValidSelectorsGroup(value)) {
    return true;
  }

  throw this.createError({ path: this.path, message: `${value} must be a valid CSS selector` });
});

const cssSelectorsListSchema = arraySchema().of(cssSelectorSchema.clone().required());

const hostnameSchema = stringSchema().matches(
  /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$/
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hostnamesListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(hostnameSchema.clone().required())
  .required();

const adTypeSchema = stringSchema().min(1);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adTypesListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(adTypeSchema.clone().required())
  .min(1)
  .required()
  .typeError('Must be a non-empty string');

const sliseAdPlacesRulesSchema = arraySchema()
  .of(
    objectSchema()
      .shape({
        urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
        selector: objectSchema().shape({
          isMultiple: booleanSchema().required(),
          cssString: cssSelectorSchema.clone().required(),
          parentDepth: numberSchema().integer().min(0).required(),
          shouldUseDivWrapper: booleanSchema().required()
        })
      })
      .required()
  )
  .required();

const makeDictionarySchema = <T>(keySchema: IStringSchema, valueSchema: Schema<T>) =>
  objectSchema()
    .test('keys-are-valid', async (value: object) => {
      await Promise.all(Object.keys(value).map(key => keySchema.validate(key)));

      return true;
    })
    .test('values-are-valid', async (value: object) => {
      await Promise.all(Object.values(value).map(value => valueSchema.validate(value)));

      return true;
    })
    .required() as IObjectSchema<Record<string, T>>;

export const sliseAdPlacesRulesDictionarySchema: IObjectSchema<Record<string, SliseAdPlacesRule[]>> =
  makeDictionarySchema(hostnameSchema, sliseAdPlacesRulesSchema);

const sliseAdProvidersByDomainRulesSchema = arraySchema()
  .of(
    objectSchema()
      .shape({
        urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
        providers: arraySchema().of(stringSchema().required()).required()
      })
      .required()
  )
  .required();

export const sliseAdProvidersByDomainsRulesDictionarySchema: IObjectSchema<
  Record<string, SliseAdProvidersByDomainRule[]>
> = makeDictionarySchema(hostnameSchema, sliseAdProvidersByDomainRulesSchema);

export const sliseAdProvidersDictionarySchema: IObjectSchema<Record<string, string[]>> = makeDictionarySchema(
  adTypeSchema.clone().required(),
  cssSelectorsListSchema.clone().required()
);
