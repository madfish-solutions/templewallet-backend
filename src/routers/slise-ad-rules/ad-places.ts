import { Router } from 'express';

import {
  getAllSliseAdPlacesRules,
  getSliseAdPlacesRulesByDomain,
  removeSliseAdPlacesRules,
  upsertSliseAdPlacesRules
} from '../../advertising/slise';
import { addObjectStorageMethodsToRouter } from '../../utils/express-helpers';
import { hostnamesListSchema, sliseAdPlacesRulesDictionarySchema } from '../../utils/schemas';

/**
 * @swagger
 * components:
 *   schemas:
 *     SliseAdPlacesRuleSelector:
 *       type: object
 *       required:
 *         - isMultiple
 *         - cssString
 *         - parentDepth
 *         - shouldUseDivWrapper
 *       properties:
 *         isMultiple:
 *           type: boolean
 *           description: Whether the selector should return multiple elements
 *         cssString:
 *           type: string
 *           description: CSS selector
 *         parentDepth:
 *           type: number
 *           min: 0
 *           integer: true
 *           description: >
 *             Indicates the depth of the parent element of the selected element, i. e. 0 means that the selected
 *             elements are ads banners themselves, 1 means that the selected elements are ads banners' direct
 *             children and so on.
 *         shouldUseDivWrapper:
 *           type: boolean
 *           description: Whether the Slise ads banner should be wrapped in a div
 *         divWrapperStyle:
 *           type: object
 *           description: Style of the div wrapper
 *           additionalProperties:
 *             type: string
 *     SliseAdStylesOverrides:
 *       type: object
 *       required:
 *         - parentDepth
 *         - style
 *       properties:
 *         parentDepth:
 *           type: number
 *           min: 0
 *           integer: true
 *           description: >
 *             Indicates the depth of the parent element for an ad banner that should change its style.
 *         style:
 *           type: object
 *           description: New style of the parent element
 *           additionalProperties:
 *             type: string
 *     SliseAdPlacesRule:
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
 *         selector:
 *           $ref: '#/components/schemas/SliseAdPlacesRuleSelector'
 *         stylesOverrides:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SliseAdStylesOverrides'
 *       example:
 *         urlRegexes:
 *           - '^https://goerli\.etherscan\.io/?$'
 *         selector:
 *           isMultiple: false
 *           cssString: 'main > section div.row > div:nth-child(2) > div'
 *           parentDepth: 0
 *           shouldUseDivWrapper: false
 *     SliseAdPlacesRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/SliseAdPlacesRule'
 *       example:
 *         goerli.etherscan.io:
 *           - urlRegexes:
 *             - '^https://goerli\.etherscan\.io/?$'
 *             selector:
 *               isMultiple: false
 *               cssString: 'main > section div.row > div:nth-child(2) > div'
 *               parentDepth: 0
 *               shouldUseDivWrapper: false
 *         www.dextools.io:
 *           - urlRegexes:
 *             - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pair-explorer'
 *             selector:
 *               isMultiple: true
 *               cssString: 'app-header-banner'
 *               parentDepth: 1
 *               shouldUseDivWrapper: false
 *           - urlRegexes:
 *             - '^https://www\.dextools\.io/app/[A-z]{2}/[0-9A-z-]+/pairs'
 *             selector:
 *               isMultiple: false
 *               cssString: 'div.left-container > app-pe-banner:nth-child(2)'
 *               parentDepth: 0
 *               shouldUseDivWrapper: true
 */

export const sliseAdPlacesRulesRouter = Router();

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/{domain}:
 *   get:
 *     summary: Get rules for ads places for the specified domain
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'goerli.etherscan.io'
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SliseAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places:
 *   get:
 *     summary: Get all rules for ads places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for ads places. If rules for a domain already exist, they will be overwritten
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SliseAdPlacesRulesDictionary'
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
 *     summary: Remove rules for ads places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of domain names to remove rules for
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
addObjectStorageMethodsToRouter(
  sliseAdPlacesRulesRouter,
  '/',
  {
    getByKey: getSliseAdPlacesRulesByDomain,
    getAllValues: getAllSliseAdPlacesRules,
    upsertValues: upsertSliseAdPlacesRules,
    removeValues: removeSliseAdPlacesRules
  },
  'domain',
  sliseAdPlacesRulesDictionarySchema,
  hostnamesListSchema,
  entriesCount => `${entriesCount} entries have been removed`
);
