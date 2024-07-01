import { Request, Router } from 'express';

import {
  filterByVersion,
  permanentNativeAdPlacesMethods,
  permanentAdPlacesMethods,
  adPlacesRulesMethods,
  PermanentAdPlacesRule,
  AdPlacesRule,
  ExtVersionConstraints
} from '../../advertising/external-ads';
import { addObjectStorageMethodsToRouter } from '../../utils/express-helpers';
import { transformValues } from '../../utils/helpers';
import {
  hostnamesListSchema,
  permanentAdPlacesRulesDictionarySchema,
  adPlacesRulesDictionarySchema
} from '../../utils/schemas';

const transformAdPlaces = <T extends ExtVersionConstraints>(value: T[], req: Request) =>
  filterByVersion(value, req.query.extVersion as string | undefined);
const transformAdPlacesDictionary = <T extends ExtVersionConstraints>(rules: Record<string, T[]>, req: Request) =>
  transformValues(rules, value => transformAdPlaces(value, req));

/**
 * @swagger
 * tags:
 *   name: Ad places
 * components:
 *   schemas:
 *     AdPlacesRuleSelector:
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
 *           description: Whether the ads banner should be wrapped in a div
 *         divWrapperStyle:
 *           type: object
 *           description: Style of the div wrapper
 *           additionalProperties:
 *             type: string
 *     AdStylesOverrides:
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
 *     ExtVersionConstraints:
 *       type: object
 *       required:
 *         - extVersion
 *       properties:
 *         extVersion:
 *           type: string
 *           description: >
 *             A range of versions where the rule is applicable. If not specified, the rule is applicable
 *             for all versions. See the [ranges format](https://www.npmjs.com/package/semver#ranges)
 *     AdPlacesRule:
 *       allOf:
 *         - $ref: '#/components/schemas/ExtVersionConstraints'
 *         - type: object
 *           required:
 *             - urlRegexes
 *             - selector
 *           properties:
 *             urlRegexes:
 *               type: array
 *               items:
 *                 type: string
 *                 format: regex
 *             selector:
 *               $ref: '#/components/schemas/AdPlacesRuleSelector'
 *             stylesOverrides:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdStylesOverrides'
 *             shouldHideOriginal:
 *               type: boolean
 *               description: Whether original ads banners should be hidden but not removed
 *               default: false
 *           example:
 *             urlRegexes:
 *               - '^https://goerli\.etherscan\.io/?$'
 *             selector:
 *               isMultiple: false
 *               cssString: 'main > section div.row > div:nth-child(2) > div'
 *               parentDepth: 0
 *               shouldUseDivWrapper: false
 *     AdPlacesRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/AdPlacesRule'
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
 *     PermanentAdPlacesRule:
 *       allOf:
 *         - $ref: '#/components/schemas/ExtVersionConstraints'
 *         - type: object
 *           description: >
 *             This object describes rules of replacing ads banners if they are found and inserting new ads banners if
 *             they are not found. Exactly one of `insertionIndex`, `insertBeforeSelector` and `insertAfterSelector`
 *             properties must be specified.
 *           required:
 *             - urlRegexes
 *             - adSelector
 *             - parentSelector
 *             - shouldUseDivWrapper
 *           properties:
 *             urlRegexes:
 *               type: array
 *               items:
 *                 type: string
 *                 format: regex
 *             adSelector:
 *               type: object
 *               description: >
 *                 This object describes rules of selecting ads banners in the parents of new ads banners selected
 *                 according to the rules described in the `parentSelector` property.
 *               required:
 *                 - isMultiple
 *                 - cssString
 *                 - parentDepth
 *               properties:
 *                 isMultiple:
 *                   type: boolean
 *                   description: Whether the selector should return multiple elements
 *                 cssString:
 *                   type: string
 *                   description: CSS selector
 *                 parentDepth:
 *                   type: number
 *                   min: 0
 *                   integer: true
 *                   description: >
 *                     Indicates the depth of the parent element of the selected element, i. e. 0 means that the selected
 *                     elements are ads banners themselves, 1 means that the selected elements are ads banners' direct
 *                     children and so on.
 *             parentSelector:
 *               type: object
 *               required:
 *                 - isMultiple
 *                 - cssString
 *                 - parentDepth
 *               properties:
 *                 isMultiple:
 *                   type: boolean
 *                   description: Whether the selector should return multiple elements
 *                 cssString:
 *                   type: string
 *                   description: CSS selector
 *                 parentDepth:
 *                   type: number
 *                   min: 0
 *                   integer: true
 *                   description: >
 *                     Indicates the depth of the parent element of the selected element, i. e. 0 means that the selected
 *                     elements are parents of new ads banners themselves, 1 means that the selected elements are their
 *                     direct children and so on.
 *             insertionIndex:
 *               type: number
 *               integer: true
 *               description: >
 *                 Describes where to insert new ads banners in the selected parents of new ads banners in case if original
 *                 ads banners are not found. If the value is negative, the insertion index will be calculated from the end.
 *                 The counting starts from 0.
 *             insertBeforeSelector:
 *               type: string
 *               description: A selector for the element before which new ads banners should be inserted
 *             insertAfterSelector:
 *               type: string
 *               description: A selector for the element after which new ads banners should be inserted
 *             insertionsCount:
 *               type: number
 *               integer: true
 *               min: 1
 *               default: 1
 *               description: >
 *                 Describes how many new ads banners should be inserted in case if original ads banners are not found.
 *             shouldUseDivWrapper:
 *               type: boolean
 *               description: Whether the ads banner should be wrapped in a div
 *             wrapperType:
 *               type: string
 *               enum:
 *                 - div
 *                 - tbody
 *             colsBefore:
 *               type: number
 *               integer: true
 *               min: 0
 *               description: >
 *                 If `wrapperType` is `tbody`, this property describes how many table columns should be inserted before
 *                 the new ads banner.
 *             colspan:
 *               type: number
 *               integer: true
 *               min: 1
 *               description: >
 *                 If `wrapperType` is `tbody`, this property describes how many table columns should be spanned by the
 *                 new ads banner.
 *             colsAfter:
 *               type: number
 *               integer: true
 *               min: 0
 *               description: >
 *                 If `wrapperType` is `tbody`, this property describes how many table columns should be inserted after
 *                 the new ads banner.
 *             elementStyle:
 *               type: object
 *               description: Style of the new ad banner
 *               additionalProperties:
 *                 type: string
 *             divWrapperStyle:
 *               type: object
 *               description: Style of the div wrapper
 *               additionalProperties:
 *                 type: string
 *             wrapperStyle:
 *               type: object
 *               description: Style of the new ad banner's wrapper
 *               additionalProperties:
 *                 type: string
 *             elementToMeasureSelector:
 *               type: string
 *               description: A selector of the element which should be measured to define banner size
 *             stylesOverrides:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdStylesOverrides'
 *             shouldHideOriginal:
 *               type: boolean
 *               description: Whether original ads banners should be hidden but not removed
 *               default: false
 *           example:
 *             urlRegexes:
 *               - '^https://etherscan\.io/tx/'
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
 *     PermanentAdPlacesRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/PermanentAdPlacesRule'
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

export const adPlacesRulesRouter = Router();

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/permanent-native/raw/all:
 *   get:
 *     summary: Get all rules for permanent native ads places
 *     tags:
 *       - Ad places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent-native/{domain}/raw:
 *   get:
 *     summary: Get all rules for permanent native ads places for the specified domain
 *     tags:
 *       - Ad places
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
 *                 $ref: '#/components/schemas/PermanentAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent-native/{domain}:
 *   get:
 *     summary: Get rules for permanent native ads places for the specified domain filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'etherscan.io'
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PermanentAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent-native:
 *   get:
 *     summary: Get all rules for permanent native ads places filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for permanent ads places. If rules for a domain already exist, they will be overwritten
 *     tags:
 *       - Ad places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
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
 *       - Ad places
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
addObjectStorageMethodsToRouter<PermanentAdPlacesRule[]>(adPlacesRulesRouter, {
  path: '/permanent-native',
  methods: permanentNativeAdPlacesMethods,
  keyName: 'domain',
  objectValidationSchema: permanentAdPlacesRulesDictionarySchema,
  keysArrayValidationSchema: hostnamesListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} entries have been removed`,
  valueTransformFn: transformAdPlaces,
  objectTransformFn: transformAdPlacesDictionary
});

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/permanent/raw/all:
 *   get:
 *     summary: Get all rules for permanent ads places
 *     tags:
 *       - Ad places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent/{domain}/raw:
 *   get:
 *     summary: Get all rules for permanent ads places for the specified domain
 *     tags:
 *       - Ad places
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
 *                 $ref: '#/components/schemas/PermanentAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent/{domain}:
 *   get:
 *     summary: Get rules for permanent ads places for the specified domain filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'etherscan.io'
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PermanentAdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/permanent:
 *   get:
 *     summary: Get all rules for permanent ads places filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for permanent ads places. If rules for a domain already exist, they will be overwritten
 *     tags:
 *       - Ad places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermanentAdPlacesRulesDictionary'
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
 *       - Ad places
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
addObjectStorageMethodsToRouter<PermanentAdPlacesRule[]>(adPlacesRulesRouter, {
  path: '/permanent',
  methods: permanentAdPlacesMethods,
  keyName: 'domain',
  objectValidationSchema: permanentAdPlacesRulesDictionarySchema,
  keysArrayValidationSchema: hostnamesListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} entries have been removed`,
  valueTransformFn: transformAdPlaces,
  objectTransformFn: transformAdPlacesDictionary
});

/**
 * @swagger
 * /api/slise-ad-rules/ad-places/raw/all:
 *   get:
 *     summary: Get all rules for ads places
 *     tags:
 *       - Ad places
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/{domain}/raw:
 *   get:
 *     summary: Get all rules for ads places for the specified domain
 *     tags:
 *       - Ad places
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
 *                 $ref: '#/components/schemas/AdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places/{domain}:
 *   get:
 *     summary: Get rules for ads places for the specified domain filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           format: hostname
 *         example: 'goerli.etherscan.io'
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Rules list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AdPlacesRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/ad-places:
 *   get:
 *     summary: Get all rules for ads places filtered by extension version
 *     tags:
 *       - Ad places
 *     parameters:
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdPlacesRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for ads places. If rules for a domain already exist, they will be overwritten
 *     tags:
 *       - Ad places
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdPlacesRulesDictionary'
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
 *       - Ad places
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
addObjectStorageMethodsToRouter<AdPlacesRule[]>(adPlacesRulesRouter, {
  path: '/',
  methods: adPlacesRulesMethods,
  keyName: 'domain',
  objectValidationSchema: adPlacesRulesDictionarySchema,
  keysArrayValidationSchema: hostnamesListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} entries have been removed`,
  valueTransformFn: transformAdPlaces,
  objectTransformFn: transformAdPlacesDictionary
});
