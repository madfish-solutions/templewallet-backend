import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { ArraySchema as IArraySchema, ObjectSchema as IObjectSchema, Schema, ValidationError } from 'yup';

import { basicAuth, BasicAuthRights } from '../middlewares/basic-auth.middleware';

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
      res.status(500).send({ error });
    }
  };

export const addObjectStorageMethodsToRouter = <V>(
  router: Router,
  path: string,
  methods: ObjectStorageMethods<V>,
  keyName: string,
  objectValidationSchema: IObjectSchema<Record<string, V>>,
  keysArrayValidationSchema: IArraySchema<string[], object>,
  successfulRemovalMessage: (removedEntriesCount: number) => string,
  modifyAuthRights: BasicAuthRights
) => {
  router.get(
    path === '/' ? `/:${keyName}` : `${path}/:${keyName}`,
    withExceptionHandler(async (req, res) => {
      const { [keyName]: key } = req.params;

      const value = await methods.getByKey(key);

      res.status(200).send(value);
    })
  );

  router
    .route(path)
    .get(
      withExceptionHandler(async (_req, res) => {
        const values = await methods.getAllValues();

        res.status(200).send(values);
      })
    )
    .post(
      basicAuth(modifyAuthRights),
      withExceptionHandler(
        withBodyValidation(objectValidationSchema, async (req, res) => {
          const validatedValues = req.body;

          await methods.upsertValues(validatedValues);

          res.status(200).send({ message: 'Values have been added successfully' });
        })
      )
    )
    .delete(
      basicAuth(modifyAuthRights),
      withExceptionHandler(
        withBodyValidation(keysArrayValidationSchema, async (req, res) => {
          const removedEntriesCount = await methods.removeValues(req.body);

          res.status(200).send({ message: successfulRemovalMessage(removedEntriesCount) });
        })
      )
    );
};
