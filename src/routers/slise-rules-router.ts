import { Router } from 'express';

import {
  getAllSliseAdContainerRules,
  getSliseAdContainerRulesByDomain,
  removeSliseAdContainerRules,
  SliseAdContainerRule,
  upsertSliseAdContainerRules
} from '../advertising/slise';
import { BasicAuthRights } from '../middlewares/basic-auth.middleware';
import { addObjectStorageMethodsToRouter } from '../utils/express-helpers';
import { hostnamesListSchema, sliseAdContainerRulesDictionarySchema } from '../utils/schemas';
import { sliseHeuristicRulesRouter } from './slise-heuristic-rules-router';

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
 *     SliseAdTypesSelectorsDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           type: string
 *       example:
 *         coinzilla:
 *           - 'iframe[src*="coinzilla.io"]'
 *           - 'iframe[src*="czilladx.com"]'
 */

export const sliseRulesRouter = Router();

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
 *         example: 'goerli.etherscan.io'
 *     responses:
 *       '200':
 *         description: Slise ad container rules for the specified domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdContainerRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
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
 *     summary: Upserts Slise ad container rules. Rules for domains that have existed before will be overwritten
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
 *             example:
 *               - 'goerli.etherscan.io'
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
addObjectStorageMethodsToRouter<SliseAdContainerRule[]>(
  sliseRulesRouter,
  '/',
  {
    getByKey: getSliseAdContainerRulesByDomain,
    getAllValues: getAllSliseAdContainerRules,
    upsertValues: upsertSliseAdContainerRules,
    removeValues: removeSliseAdContainerRules
  },
  'domain',
  sliseAdContainerRulesDictionarySchema,
  hostnamesListSchema,
  removedEntriesCount => `${removedEntriesCount} domains have been removed`,
  BasicAuthRights.ManageAds
);
