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

type TypedBodyRequestHandler<T> = (
  req: Request<Record<string, string>, unknown, T>,
  res: Response,
  next: NextFunction
) => void;

export const withBodyValidation =
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

interface ObjectStorageMethodsEntrypointsConfig<U, V> {
  path: string;
  methods: ObjectStorageMethods<U>;
  keyName: string;
  objectValidationSchema: IObjectSchema<Record<string, U>>;
  keysArrayValidationSchema: IArraySchema<string[], object>;
  successfulRemovalMessage: (removedEntriesCount: number) => string;
  transformGotValueFn?: (value: U, req: Request) => V;
}

export const addObjectStorageMethodsToRouter = <U, V = U>(
  router: Router,
  config: ObjectStorageMethodsEntrypointsConfig<U, V>
) => {
  const {
    path,
    methods,
    keyName,
    objectValidationSchema,
    keysArrayValidationSchema,
    successfulRemovalMessage,
    transformGotValueFn = value => value as unknown as V
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

      res.status(200).send(transformGotValueFn(value, req));
    })
  );

  router
    .route(path)
    .get(
      withExceptionHandler(async (req, res) => {
        const values = await methods.getAllValues();

        res
          .status(200)
          .header('Cache-Control', 'public, max-age=300')
          .send(
            Object.fromEntries(Object.entries(values).map(([key, value]) => [key, transformGotValueFn(value, req)]))
          );
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
