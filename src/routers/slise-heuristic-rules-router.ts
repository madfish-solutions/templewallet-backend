import { Router } from 'express';

import {
  addSliseHeuristicUrlRegexes,
  getAllSliseHeuristicSelectors,
  getSliseHeuristicSelectorsByAdType,
  getSliseHeuristicUrlRegexes,
  removeSliseHeuristicSelectors,
  removeSliseHeuristicUrlRegexes,
  upsertSliseHeuristicSelectors
} from '../advertising/slise';
import { basicAuth } from '../middlewares/basic-auth.middleware';
import { addObjectStorageMethodsToRouter, withBodyValidation, withExceptionHandler } from '../utils/express-helpers';
import { adTypesListSchema, regexStringListSchema, sliseSelectorsDictionarySchema } from '../utils/schemas';

export const sliseHeuristicRulesRouter = Router();

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
 *               example:
 *                 - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pair-explorer'
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
 *             example:
 *               - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pair-explorer'
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
 *             example:
 *               - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pair-explorer'
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
    basicAuth,
    withExceptionHandler(
      withBodyValidation(regexStringListSchema, async (req, res) => {
        const regexesAddedCount = await addSliseHeuristicUrlRegexes(req.body);

        res.status(200).send({ message: `${regexesAddedCount} regexes have been added` });
      })
    )
  )
  .delete(
    basicAuth,
    withExceptionHandler(
      withBodyValidation(regexStringListSchema, async (req, res) => {
        const regexesRemovedCount = await removeSliseHeuristicUrlRegexes(req.body);

        res.status(200).send({ message: `${regexesRemovedCount} regexes have been removed` });
      })
    )
  );

/**
 * @swagger
 * /api/slise-ad-container-rules/heuristic/selectors/{adType}:
 *   get:
 *     summary: Get CSS selectors for heuristic search for specified ad type
 *     parameters:
 *       - in: path
 *         name: adType
 *         required: true
 *         type: string
 *         example: 'coinzilla'
 *     responses:
 *       '200':
 *         description: List of CSS selectors
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example:
 *                 - 'iframe[src*="coinzilla.io"]'
 *                 - 'iframe[src*="czilladx.com"]'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-container-rules/heuristic/selectors:
 *   get:
 *     summary: Get CSS selectors for heuristic search for all ads types
 *     responses:
 *       '200':
 *         description: Ad type - selectors list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdTypesSelectorsDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Upserts CSS selectors for heuristic search. Selectors for ad types that have existed before will be overwritten
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Ad type - selectors list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SliseAdTypesSelectorsDictionary'
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
 *       description: List of ads types
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example:
 *               - 'coinzilla'
 *               - 'bitmedia'
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
addObjectStorageMethodsToRouter<string[]>(
  sliseHeuristicRulesRouter,
  '/selectors',
  {
    getByKey: getSliseHeuristicSelectorsByAdType,
    getAllValues: getAllSliseHeuristicSelectors,
    upsertValues: upsertSliseHeuristicSelectors,
    removeValues: removeSliseHeuristicSelectors
  },
  'adType',
  sliseSelectorsDictionarySchema,
  adTypesListSchema,
  removedEntriesCount => `${removedEntriesCount} ad types have been removed`
);
