import {
  array as arraySchema,
  ArraySchema as IArraySchema,
  boolean as booleanSchema,
  object as objectSchema,
  ObjectSchema as IObjectSchema,
  string as stringSchema
} from 'yup';

import { SliseAdContainerRule } from '../advertising/slise';
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

export const regexStringListSchema = arraySchema().of(regexStringSchema.clone().required()).required();

const cssSelectorSchema = stringSchema().test('is-css-selector', function (value: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (isDefined(value) && isValidSelectorsGroup(value)) {
    return true;
  }

  throw this.createError({ path: this.path, message: `${value} must be a valid CSS selector` });
});

const sliseAdContainerRulesSchema = arraySchema().of(
  objectSchema().shape({
    urlRegexes: arraySchema().of(regexStringSchema.clone().required()).required(),
    selector: objectSchema().shape({
      isMultiple: booleanSchema().required(),
      cssString: cssSelectorSchema.clone().required(),
      shouldUseResultParent: booleanSchema().required(),
      shouldUseDivWrapper: booleanSchema().required()
    })
  })
);

const hostnameSchema = stringSchema().matches(
  /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$/
);

export const sliseAdContainerRulesDictionarySchema: IObjectSchema<Record<string, SliseAdContainerRule[]>> =
  objectSchema()
    .test('keys-are-hostnames', async (value: object) => {
      await Promise.all(Object.keys(value).map(hostname => hostnameSchema.validate(hostname)));

      return true;
    })
    .test('values-are-valid', async (value: unknown) => {
      if (typeof value !== 'object' || value === null) {
        return true;
      }

      await Promise.all(Object.values(value).map(rules => sliseAdContainerRulesSchema.validate(rules)));

      return true;
    })
    .required();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hostnamesListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(hostnameSchema.clone().required())
  .required();

const adTypeSchema = stringSchema().min(1).required();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adTypesListSchema: IArraySchema<string[], object, any> = arraySchema()
  .of(adTypeSchema.clone())
  .min(1)
  .required()
  .typeError('Must be a non-empty string');

const selectorsListSchema = arraySchema().of(cssSelectorSchema.clone().required()).required();

export const sliseSelectorsDictionarySchema: IObjectSchema<Record<string, string[]>> = objectSchema()
  .test('keys-are-valid', async (value: object) => {
    await Promise.all(Object.keys(value).map(adType => adTypeSchema.clone().validate(adType)));

    return true;
  })
  .test('values-are-valid', async (value: object) => {
    await Promise.all(Object.values(value).map(selectors => selectorsListSchema.validate(selectors)));

    return true;
  });
