import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import Joi, { Schema, ArraySchema, ObjectSchema } from 'joi';

import {
  addSliseHeuristicSelectors,
  addSliseHeuristicUrlRegexes,
  getAllSliseAdContainerRules,
  getSliseAdContainerRulesByDomain,
  getSliseHeuristicSelectors,
  getSliseHeuristicUrlRegexes,
  removeSliseAdContainerRules,
  removeSliseHeuristicSelectors,
  removeSliseHeuristicUrlRegexes,
  SliseAdContainerRule,
  upsertSliseAdContainerRules
} from '../advertising/slise';
import { basicAuth, BasicAuthRights } from '../middlewares/basic-auth.middleware';

type TypedBodyRequestHandler<T> = (
  req: Request<Record<string, string>, unknown, T>,
  res: Response,
  next: NextFunction
) => void;

const withBodyValidation =
  <T>(schema: Schema<T>, handler: TypedBodyRequestHandler<T>): RequestHandler =>
  (req, res, next) => {
    const { value, error } = schema.validate(req.body);

    if (error) {
      return res.status(400).send({ error: error.message });
    }

    req.body = value;

    return handler(req, res, next);
  };

const withExceptionHandler =
  (handler: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      res.status(500).send({ error });
    }
  };

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     basicAuth:
 *       type: http
 *       scheme: basic
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication information is missing or invalid
 *       headers:
 *         WWW_Authenticate:
 *           schema:
 *             type: string
 *     ErrorResponse:
 *       description: Error response
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *     SuccessResponse:
 *       description: Success response
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *   schemas:
 *     SliseAdContainerSelector:
 *       type: object
 *       required:
 *         - isMultiple
 *         - cssString
 *         - shouldUseResultParent
 *         - shouldUseDivWrapper
 *       properties:
 *         isMultiple:
 *           type: boolean
 *           description: Whether the selector should return multiple elements
 *         cssString:
 *           type: string
 *           description: CSS selector
 *         shouldUseResultParent:
 *           type: boolean
 *           description: Whether the results parents should be used as ads containers
 *         shouldUseDivWrapper:
 *           type: boolean
 *           description: Whether the ads banner should be wrapped in a div
 *     SliseAdContainerRule:
 *       type: object
 *       required:
 *         - urlRegexes
 *         - selector
 *       properties:
 *         urlRegexes:
 *           type: array
 *           items:
 *             type: string
 *             format: regex
 *           description: List of regexes to match the site URL against
 *         selector:
 *           $ref: '#/components/schemas/SliseAdContainerSelector'
 *     SliseAdContainerRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/SliseAdContainerRule'
 *       description: Dictionary of rules for domains
 *       example:
 *         goerli.etherscan.io:
 *           - urlRegexes:
 *             - '^https://goerli\.etherscan\.io/?$'
 *             selector:
 *               isMultiple: false
 *               cssString: 'main > section div.row > div:nth-child(2) > div'
 *               shouldUseResultParent: false
 *               shouldUseDivWrapper: false
 *         www.dextools.io:
 *           - urlRegexes:
 *             - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pair-explorer'
 *             selector:
 *               isMultiple: true
 *               cssString: 'app-header-banner'
 *               shouldUseResultParent: true
 *               shouldUseDivWrapper: false
 *           - urlRegexes:
 *             - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pairs'
 *             selector:
 *               isMultiple: false
 *               cssString: 'div.left-container > app-pe-banner:nth-child(2)'
 *               shouldUseResultParent: false
 *               shouldUseDivWrapper: true
 */

export const sliseRulesRouter = Router();

const sliseAdContainerRulesDictionarySchema: ObjectSchema<Record<string, SliseAdContainerRule[]>> =
  Joi.object().pattern(
    Joi.string().hostname(),
    Joi.array()
      .items(
        Joi.object({
          urlRegexes: Joi.array().items(Joi.string()).required(),
          selector: Joi.object({
            isMultiple: Joi.boolean().required(),
            cssString: Joi.string().required(),
            shouldUseResultParent: Joi.boolean().required(),
            shouldUseDivWrapper: Joi.boolean().required()
          }).required()
        })
      )
      .required()
  );

const makeStringArraySchema = (errorMessage: string): ArraySchema<string[]> =>
  Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required()
    .error(() => errorMessage);

const sliseHeuristicRulesRouter = Router();

/**
 * @swagger
 * /api/slise-ad-container-rules/heuristic/url-regexes:
 *   get:
 *     summary: Get regexes for pages URLs where heuristic search, i.e. by provider, should be used
 *     responses:
 *       '200':
 *         description: List of regexes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 format: regex
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add regexes for pages URLs where heuristic search, i.e. by provider, should be used
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of regexes
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *               format: regex
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   delete:
 *     summary: Remove regexes for pages URLs where heuristic search, i.e. by provider, should be used
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of regexes
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *               format: regex
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 */
sliseHeuristicRulesRouter
  .route('/url-regexes')
  .get(
    withExceptionHandler(async (_req, res) => {
      const regexes = await getSliseHeuristicUrlRegexes();

      res.status(200).send(regexes);
    })
  )
  .post(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(makeStringArraySchema('The body should be an array of regexp strings'), async (req, res) => {
        const regexesAddedCount = await addSliseHeuristicUrlRegexes(req.body);

        res.status(200).send({ message: `${regexesAddedCount} regexes have been added` });
      })
    )
  )
  .delete(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(makeStringArraySchema('The body should be an array of regexp strings'), async (req, res) => {
        const regexesRemovedCount = await removeSliseHeuristicUrlRegexes(req.body);

        res.status(200).send({ message: `${regexesRemovedCount} regexes have been removed` });
      })
    )
  );

/**
 * @swagger
 * /api/slise-ad-container-rules/heuristic/selectors:
 *   get:
 *     summary: Get CSS selectors for heuristic search
 *     responses:
 *       '200':
 *         description: List of CSS selectors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add CSS selectors for heuristic search
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of CSS selectors
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   delete:
 *     summary: Remove CSS selectors for heuristic search
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of CSS selectors
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 */
sliseHeuristicRulesRouter
  .route('/selectors')
  .get(
    withExceptionHandler(async (_req, res) => {
      const selectors = await getSliseHeuristicSelectors();

      res.status(200).send(selectors);
    })
  )
  .post(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(
        makeStringArraySchema('The body should be an array of CSS selector strings'),
        async (req, res) => {
          const selectorsAddedCount = await addSliseHeuristicSelectors(req.body);

          res.status(200).send({ message: `${selectorsAddedCount} selectors have been added` });
        }
      )
    )
  )
  .delete(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(
        makeStringArraySchema('The body should be an array of CSS selector strings'),
        async (req, res) => {
          const selectorsRemovedCount = await removeSliseHeuristicSelectors(req.body);

          res.status(200).send({ message: `${selectorsRemovedCount} selectors have been removed` });
        }
      )
    )
  );

sliseRulesRouter.use('/heuristic', sliseHeuristicRulesRouter);

/**
 * @swagger
 * /api/slise-ad-container-rules/{domain}:
 *   get:
 *     summary: Get Slise ad container rule for specified domain
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         format: hostname
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Slise ad container rule for the specified domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdContainerRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 */
sliseRulesRouter.get('/:domain', async (req, res) => {
  try {
    const { domain } = req.params;

    const rule = await getSliseAdContainerRulesByDomain(domain);

    res.status(200).send(rule);
  } catch (error) {
    res.status(500).send({ error });
  }
});

/**
 * @swagger
 * /api/slise-ad-container-rules:
 *   get:
 *     summary: Get all Slise ad container rules
 *     responses:
 *       '200':
 *         description: List of Slise ad container rules
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdContainerRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Upserts Slise ad container rules
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary of rules
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SliseAdContainerRulesDictionary'
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   delete:
 *     summary: Delete specified Slise ad container rules
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of rule IDs to delete
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *               format: hostname
 *     responses:
 *       '200':
 *         $ref: '#/components/responses/SuccessResponse'
 *       '400':
 *         $ref: '#/components/responses/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 */
sliseRulesRouter
  .route('/')
  .get(
    withExceptionHandler(async (_req, res) => {
      const rules = await getAllSliseAdContainerRules();

      res.status(200).send(rules);
    })
  )
  .post(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(sliseAdContainerRulesDictionarySchema, async (req, res) => {
        const validatedRules = req.body;

        // Adding regex validation to joi is a bit buggy
        for (const domain in validatedRules) {
          for (const rule of validatedRules[domain]) {
            for (const regex of rule.urlRegexes) {
              try {
                new RegExp(regex);
              } catch (error) {
                return res.status(400).send({ error: `Invalid regex: ${regex}` });
              }
            }
          }
        }

        await upsertSliseAdContainerRules(validatedRules);

        res.status(200).send({ message: 'Rules have been added successfully' });
      })
    )
  )
  .delete(
    basicAuth(BasicAuthRights.ManageAds),
    withExceptionHandler(
      withBodyValidation(makeStringArraySchema('Domains should be an array of strings'), async (req, res) => {
        const removedEntriesCount = await removeSliseAdContainerRules(req.body);

        res.status(200).send({ message: `${removedEntriesCount} entries have been removed` });
      })
    )
  );
