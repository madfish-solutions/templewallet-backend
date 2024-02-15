import { Router } from 'express';

import {
  permanentNativeAdPlacesMethods,
  permanentSliseAdPlacesMethods,
  sliseAdPlacesRulesMethods
} from '../../advertising/slise';
import { addObjectStorageMethodsToRouter } from '../../utils/express-helpers';
import {
  hostnamesListSchema,
  permanentSliseAdPlacesRulesDictionarySchema,
  sliseAdPlacesRulesDictionarySchema
} from '../../utils/schemas';

/**
 * @swagger
 * tags:
 *   name: Slise ad places
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
 *     PermanentSliseAdPlacesRule:
 *       type: object
 *       description: >
 *         This object describes rules of replacing ads banners if they are found and inserting new ads banners if
 *         they are not found. Exactly one of `insertionIndex`, `insertBeforeSelector` and `insertAfterSelector`
 *         properties must be specified.
 *       required:
 *         - urlRegexes
 *         - adSelector
 *         - parentSelector
 *         - shouldUseDivWrapper
 *       properties:
 *         urlRegexes:
 *           type: array
 *           items:
 *             type: string
 *             format: regex
 *         adSelector:
 *           type: object
 *           description: >
 *             This object describes rules of selecting ads banners in the parents of new ads banners selected
 *             according to the rules described in the `parentSelector` property.
 *           required:
 *             - isMultiple
 *             - cssString
 *             - parentDepth
 *           properties:
 *             isMultiple:
 *               type: boolean
 *               description: Whether the selector should return multiple elements
 *             cssString:
 *               type: string
 *               description: CSS selector
 *             parentDepth:
 *               type: number
 *               min: 0
 *               integer: true
 *               description: >
 *                 Indicates the depth of the parent element of the selected element, i. e. 0 means that the selected
 *                 elements are ads banners themselves, 1 means that the selected elements are ads banners' direct
 *                 children and so on.
 *         parentSelector:
 *           type: object
 *           required:
 *             - isMultiple
 *             - cssString
 *             - parentDepth
 *           properties:
 *             isMultiple:
 *               type: boolean
 *               description: Whether the selector should return multiple elements
 *             cssString:
 *               type: string
 *               description: CSS selector
 *             parentDepth:
 *               type: number
 *               min: 0
 *               integer: true
 *               description: >
 *                 Indicates the depth of the parent element of the selected element, i. e. 0 means that the selected
 *                 elements are parents of new ads banners themselves, 1 means that the selected elements are their
 *                 direct children and so on.
 *         insertionIndex:
 *           type: number
 *           integer: true
 *           description: >
 *             Describes where to insert new ads banners in the selected parents of new ads banners in case if original
 *             ads banners are not found. If the value is negative, the insertion index will be calculated from the end.
 *             The counting starts from 0.
 *         insertBeforeSelector:
 *           type: string
 *           description: A selector for the element before which new ads banners should be inserted
 *         insertAfterSelector:
 *           type: string
 *           description: A selector for the element after which new ads banners should be inserted
 *         insertionsCount:
 *           type: number
 *           integer: true
 *           min: 1
 *           default: 1
 *           description: >
 *             Describes how many new ads banners should be inserted in case if original ads banners are not found.
 *         shouldUseDivWrapper:
 *           type: boolean
 *           description: Whether the Slise ads banner should be wrapped in a div
 *         elementStyle:
 *           type: object
 *           description: Style of the new ad banner
 *           additionalProperties:
 *             type: string
 *         divWrapperStyle:
 *           type: object
 *           description: Style of the div wrapper
 *           additionalProperties:
 *             type: string
 *         elementToMeasureSelector:
 *           type: string
 *           description: A selector of the element which should be measured to define banner size
 *         stylesOverrides:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SliseAdStylesOverrides'
 *         shouldHideOriginal:
 *           type: boolean
 *           description: Whether original ads banners should be hidden but not removed
 *           default: false
 *       example:
 *         urlRegexes:
 *           - '^https://etherscan\.io/tx/'
 *         adSelector:
 *           isMultiple: false
 *           cssString: '.coinzilla'
 *           parentDepth: 0
 *         parentSelector:
 *           isMultiple: false
 *           cssString: '#ContentPlaceHolder1_maintable > * > .row:nth-child(8) > :nth-child(2) > * > *'
 *           parentDepth: 0
 *         insertionIndex: 0
 *         shouldUseDivWrapper: false
 *     PermanentSliseAdPlacesRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/PermanentSliseAdPlacesRule'
 *       example:
 *         etherscan.io:
 *           - urlRegexes:
 *             - '^https://etherscan\.io/tx/'
 *             adSelector:
 *               isMultiple: false
 *               cssString: '.coinzilla'
 *               parentDepth: 0
 *             parentSelector:
 *               isMultiple: false
 *               cssString: '#ContentPlaceHolder1_maintable > * > .row:nth-child(8) > :nth-child(2) > * > *'
 *               parentDepth: 0
 *             insertionIndex: 0
 *             shouldUseDivWrapper: false
 */

export const sliseAdPlacesRulesRouter = Router();

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/permanent-native/{domain}:
 *   get:
 *     summary: Get rules for permanent native ads places for the specified domain
 *     tags:
 *       - Slise ad places
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'etherscan.io'
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PermanentSliseAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent-native:
 *   get:
 *     summary: Get all rules for permanent native ads places
 *     tags:
 *       - Slise ad places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentSliseAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for permanent ads places. If rules for a domain already exist, they will be overwritten
 *     tags:
 *       - Slise ad places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermanentSliseAdPlacesRulesDictionary'
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
 *     summary: Remove rules for permanent ads places
 *     tags:
 *       - Slise ad places
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
 *               - 'etherscan.io'
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
  '/permanent-native',
  permanentNativeAdPlacesMethods,
  'domain',
  permanentSliseAdPlacesRulesDictionarySchema,
  hostnamesListSchema,
  entriesCount => `${entriesCount} entries have been removed`
);

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/permanent/{domain}:
 *   get:
 *     summary: Get rules for permanent ads places for the specified domain
 *     tags:
 *       - Slise ad places
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'etherscan.io'
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PermanentSliseAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent:
 *   get:
 *     summary: Get all rules for permanent ads places
 *     tags:
 *       - Slise ad places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentSliseAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for permanent ads places. If rules for a domain already exist, they will be overwritten
 *     tags:
 *       - Slise ad places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermanentSliseAdPlacesRulesDictionary'
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
 *     summary: Remove rules for permanent ads places
 *     tags:
 *       - Slise ad places
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
 *               - 'etherscan.io'
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
  '/permanent',
  permanentSliseAdPlacesMethods,
  'domain',
  permanentSliseAdPlacesRulesDictionarySchema,
  hostnamesListSchema,
  entriesCount => `${entriesCount} entries have been removed`
);

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/{domain}:
 *   get:
 *     summary: Get rules for ads places for the specified domain
 *     tags:
 *       - Slise ad places
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
 *     tags:
 *       - Slise ad places
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
 *     tags:
 *       - Slise ad places
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
 *     tags:
 *       - Slise ad places
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
  sliseAdPlacesRulesMethods,
  'domain',
  sliseAdPlacesRulesDictionarySchema,
  hostnamesListSchema,
  entriesCount => `${entriesCount} entries have been removed`
);
