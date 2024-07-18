import { Router } from 'express';

import {
  filterRules,
  ReplaceAdsUrlsBlacklistEntry,
  replaceAdsUrlsBlacklistMethods
} from '../../advertising/external-ads';
import { addObjectStorageMethodsToRouter } from '../../utils/express-helpers';
import { nonEmptyStringsListSchema, replaceUrlsBlacklistDictionarySchema } from '../../utils/schemas';

export const replaceUrlsBlacklistRouter = Router();

/**
 * @swagger
 * tags:
 *   name: URLs blacklist for replacing ads
 * components:
 *   schemas:
 *     ReplaceAdsUrlsBlacklistEntry:
 *       allOf:
 *         - $ref: '#/components/schemas/ExtVersionConstraints'
 *         - type: object
 *           required:
 *             - regexes
 *           properties:
 *             regexes:
 *               type: array
 *               items:
 *                 type: string
 *                 format: regex
 *     ReplaceAdsUrlsBlacklistDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/ReplaceAdsUrlsBlacklistEntry'
 *       example:
 *         'arbitrary-key':
 *           - extVersion: '>=1.21.1'
 *             regexes:
 *               - "^https://[^/?#]*google\\.com"
 *               - "^https://[^/?#]*youtube\\.com"
 * /api/slise-ad-rules/replace-urls-blacklist/raw/all:
 *   get:
 *     summary: Get all blacklist entries
 *     tags:
 *       - URLs blacklist for replacing ads
 *     responses:
 *       '200':
 *         description: A dictionary of all blacklist entries
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReplaceAdsUrlsBlacklistDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/replace-urls-blacklist/{id}/raw:
 *   get:
 *     summary: Get blacklist entries by array ID
 *     tags:
 *       - URLs blacklist for replacing ads
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           description: Array ID
 *     responses:
 *       '200':
 *         description: An array of blacklist entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReplaceAdsUrlsBlacklistEntry'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/replace-urls-blacklist/{id}:
 *   get:
 *     summary: Get blacklist entries by array ID filtered by extension version
 *     tags:
 *       - URLs blacklist for replacing ads
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           description: Array ID
 *       - name: extVersion
 *         in: query
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: Extension version
 *     responses:
 *       '200':
 *         description: An array of blacklist entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/replace-urls-blacklist:
 *   get:
 *     summary: Get all blacklist entries filtered by extension version
 *     tags:
 *       - URLs blacklist for replacing ads
 *     parameters:
 *       - name: extVersion
 *         in: query
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: Extension version
 *     responses:
 *       '200':
 *         description: A dictionary of blacklist entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add blacklist entries
 *     tags:
 *       - URLs blacklist for replacing ads
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: A dictionary of blacklist entries
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplaceAdsUrlsBlacklistDictionary'
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
 *     summary: Remove blacklist entries by arrays IDs
 *     tags:
 *       - URLs blacklist for replacing ads
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: An array of arrays IDs
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
addObjectStorageMethodsToRouter<ReplaceAdsUrlsBlacklistEntry[], string[], string[]>(replaceUrlsBlacklistRouter, {
  path: '/',
  methods: replaceAdsUrlsBlacklistMethods,
  keyName: 'id',
  objectValidationSchema: replaceUrlsBlacklistDictionarySchema,
  keysArrayValidationSchema: nonEmptyStringsListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} blacklist entries have been removed`,
  objectTransformFn: (value, req) =>
    filterRules(Object.values(value).flat(), req.query.extVersion as string | undefined)
      .map(({ regexes }) => regexes)
      .flat(),
  valueTransformFn: (value, req) =>
    filterRules(value, req.query.extVersion as string | undefined)
      .map(({ regexes }) => regexes)
      .flat()
});
