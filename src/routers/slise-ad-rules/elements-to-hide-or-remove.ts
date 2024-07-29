import { Router, Request } from 'express';

import {
  ElementsToHideOrRemoveEntry,
  elementsToHideOrRemoveMethods,
  filterRules
} from '../../advertising/external-ads';
import { addObjectStorageMethodsToRouter } from '../../utils/express-helpers';
import { transformValues } from '../../utils/helpers';
import { elementsToHideOrRemoveDictionarySchema, hostnamesListSchema } from '../../utils/schemas';

export const elementsToHideOrRemoveRouter = Router();

const transformElementsToHideOrRemoveRules = (value: ElementsToHideOrRemoveEntry[], req: Request) =>
  filterRules(value, req.query.extVersion as string | undefined);
const transformRulesDictionary = (value: Record<string, ElementsToHideOrRemoveEntry[]>, req: Request) =>
  transformValues(value, rules => filterRules(rules, req.query.extVersion as string | undefined));

/**
 * @swagger
 * tags:
 *   name: Elements to hide or remove
 * components:
 *   schemas:
 *     ElementsToHideOrRemoveEntry:
 *       allOf:
 *         - $ref: '#/components/schemas/ExtVersionConstraints'
 *         - type: object
 *           required:
 *             - cssString
 *             - parentDepth
 *             - isMultiple
 *             - urlRegexes
 *             - shouldHide
 *           properties:
 *             cssString:
 *               type: string
 *             parentDepth:
 *               type: number
 *               min: 0
 *               integer: true
 *               description: >
 *                 Indicates the depth of the parent element of the selected element
 *             isMultiple:
 *               type: boolean
 *               description: Whether the selector should select multiple elements
 *             urlRegexes:
 *               type: array
 *               items:
 *                 type: string
 *                 format: regex
 *             shouldHide:
 *               type: boolean
 *     ElementsToHideOrRemoveDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/ElementsToHideOrRemoveEntry'
 *       example:
 *         'm.economictimes.com':
 *           - extVersion: '>=1.21.1'
 *             cssString: '#iframeDisplay, #closeDisplay'
 *             parentDepth: 0
 *             isMultiple: true
 *             urlRegexes:
 *               - "^https://m\\.economictimes\\.com"
 *             shouldHide: true
 * /api/slise-ad-rules/elements-to-hide-or-remove/raw/all:
 *   get:
 *     summary: Get all rules for hiding or removing elements
 *     tags:
 *       - Elements to hide or remove
 *     responses:
 *       '200':
 *         description: A dictionary of all rules
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElementsToHideOrRemoveDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/elements-to-hide-or-remove/{domain}/raw:
 *   get:
 *     summary: Get rules for hiding or removing elements by domain
 *     tags:
 *       - Elements to hide or remove
 *     parameters:
 *       - name: domain
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           description: Domain name
 *     responses:
 *       '200':
 *         description: An array of rules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ElementsToHideOrRemoveEntry'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/elements-to-hide-or-remove/{domain}:
 *   get:
 *     summary: Get rules for hiding or removing elements by domain and extension version
 *     tags:
 *       - Elements to hide or remove
 *     parameters:
 *       - name: domain
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           description: Domain name
 *       - name: extVersion
 *         in: query
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *           description: Extension version
 *     responses:
 *       '200':
 *         description: An array of rules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ElementsToHideOrRemoveEntry'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/elements-to-hide-or-remove:
 *   get:
 *     summary: Get all rules for hiding or removing elements filtered by extension version
 *     tags:
 *       - Elements to hide or remove
 *     parameters:
 *       - name: extVersion
 *         in: query
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *           description: Extension version
 *     responses:
 *       '200':
 *         description: A dictionary of rules
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ElementsToHideOrRemoveDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add rules for hiding or removing elements. If a rule already exists, it will be updated
 *     tags:
 *       - Elements to hide or remove
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *            $ref: '#/components/schemas/ElementsToHideOrRemoveDictionary'
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
 *     summary: Delete rules for hiding or removing elements
 *     tags:
 *       - Elements to hide or remove
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *           example:
 *             - 'm.economictimes.com'
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
addObjectStorageMethodsToRouter(elementsToHideOrRemoveRouter, {
  path: '/',
  methods: elementsToHideOrRemoveMethods,
  keyName: 'domain',
  objectValidationSchema: elementsToHideOrRemoveDictionarySchema,
  keysArrayValidationSchema: hostnamesListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} entries have been removed`,
  objectTransformFn: transformRulesDictionary,
  valueTransformFn: transformElementsToHideOrRemoveRules
});
