import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { ArraySchema as IArraySchema, ObjectSchema as IObjectSchema, Schema, ValidationError } from 'yup';

import { basicAuth } from '../middlewares/basic-auth.middleware';

import logger from './logger';

interface ObjectStorageMethods<V> {
  getByKey: (key: string) => Promise<V>;
  getAllValues: () => Promise<Record<string, V>>;
  upsertValues: (newValues: Record<string, V>) => Promise<'OK'>;
  removeValues: (keys: string[]) => Promise<number>;
}

interface SetStorageMethods {
  addValues: (values: string[]) => Promise<number>;
  removeValues: (values: string[]) => Promise<number>;
  getAllValues: () => Promise<string[]>;
}

type TypedBodyRequestHandler<T> = (
  req: Request<Record<string, string>, unknown, T>,
  res: Response,
  next: NextFunction
) => void;

const withBodyValidation =
  <T>(schema: Schema<T>, handler: TypedBodyRequestHandler<T>): RequestHandler =>
  async (req, res, next) => {
    try {
      req.body = await schema.validate(req.body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).send({ error: error.message });
      }

      throw error;
    }

    return handler(req, res, next);
  };

export const withExceptionHandler =
  (handler: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      logger.error(error as object);
      res.status(500).send({ error });
    }
  };

interface ObjectStorageMethodsEntrypointsConfig<StoredValue, ObjectResponse, ValueResponse> {
  path: string;
  methods: ObjectStorageMethods<StoredValue>;
  keyName: string;
  objectValidationSchema: IObjectSchema<Record<string, StoredValue>>;
  keysArrayValidationSchema: IArraySchema<string[], object>;
  successfulRemovalMessage: (removedEntriesCount: number) => string;
  objectTransformFn: (value: Record<string, StoredValue>, req: Request) => ObjectResponse;
  valueTransformFn: (value: StoredValue, req: Request) => ValueResponse;
}

interface SetStorageMethodsEntrypointsConfig {
  path: string;
  methods: SetStorageMethods;
  arrayValidationSchema: IArraySchema<string[], object>;
  successfulAdditionMessage: (addedEntriesCount: number) => string;
  successfulRemovalMessage: (removedEntriesCount: number) => string;
}

export const addSetStorageMethodsToRouter = (router: Router, config: SetStorageMethodsEntrypointsConfig) => {
  const { path, methods, arrayValidationSchema, successfulAdditionMessage, successfulRemovalMessage } = config;

  router
    .route(path)
    .get(
      withExceptionHandler(async (_req, res) => {
        res
          .status(200)
          .header('Cache-Control', 'public, max-age=300')
          .send(await methods.getAllValues());
      })
    )
    .post(
      basicAuth,
      withExceptionHandler(
        withBodyValidation(arrayValidationSchema, async (req, res) => {
          res.status(200).send({ message: successfulAdditionMessage(await methods.addValues(req.body)) });
        })
      )
    )
    .delete(
      basicAuth,
      withExceptionHandler(
        withBodyValidation(arrayValidationSchema, async (req, res) => {
          res.status(200).send({ message: successfulRemovalMessage(await methods.removeValues(req.body)) });
        })
      )
    );
};

export const addObjectStorageMethodsToRouter = <
  StoredValue,
  ObjectResponse = Record<string, StoredValue>,
  ValueResponse = StoredValue
>(
  router: Router,
  config: ObjectStorageMethodsEntrypointsConfig<StoredValue, ObjectResponse, ValueResponse>
) => {
  const {
    path,
    methods,
    keyName,
    objectValidationSchema,
    keysArrayValidationSchema,
    successfulRemovalMessage,
    objectTransformFn,
    valueTransformFn
  } = config;

  router.get(
    path === '/' ? '/raw/all' : `${path}/raw/all`,
    withExceptionHandler(async (_req, res) => {
      const values = await methods.getAllValues();

      res.status(200).send(values);
    })
  );

  router.get(
    path === '/' ? `/:${keyName}/raw` : `${path}/:${keyName}/raw`,
    withExceptionHandler(async (req, res) => {
      const { [keyName]: key } = req.params;

      const value = await methods.getByKey(key);

      res.status(200).header('Cache-Control', 'public, max-age=300').send(value);
    })
  );

  router.get(
    path === '/' ? `/:${keyName}` : `${path}/:${keyName}`,
    withExceptionHandler(async (req, res) => {
      const { [keyName]: key } = req.params;

      const value = await methods.getByKey(key);

      res.status(200).send(valueTransformFn(value, req));
    })
  );

  router
    .route(path)
    .get(
      withExceptionHandler(async (req, res) => {
        const values = await methods.getAllValues();

        res.status(200).header('Cache-Control', 'public, max-age=300').send(objectTransformFn(values, req));
      })
    )
    .post(
      basicAuth,
      withExceptionHandler(
        withBodyValidation(objectValidationSchema, async (req, res) => {
          const validatedValues = req.body;

          await methods.upsertValues(validatedValues);

          res.status(200).send({ message: 'Values have been added successfully' });
        })
      )
    )
    .delete(
      basicAuth,
      withExceptionHandler(
        withBodyValidation(keysArrayValidationSchema, async (req, res) => {
          const removedEntriesCount = await methods.removeValues(req.body);

          res.status(200).send({ message: successfulRemovalMessage(removedEntriesCount) });
        })
      )
    );
};
