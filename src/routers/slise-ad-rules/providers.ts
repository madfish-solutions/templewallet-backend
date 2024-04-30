import { Request, Router } from 'express';
import { identity } from 'lodash';

import {
  addAdProvidersForAllSites,
  getAdProvidersForAllSites,
  removeAdProvidersForAllSites,
  adProvidersMethods,
  adProvidersByDomainRulesMethods,
  AdProviderSelectorsRule,
  filterByVersion,
  AdProvidersByDomainRule
} from '../../advertising/external-ads';
import { basicAuth } from '../../middlewares/basic-auth.middleware';
import { addObjectStorageMethodsToRouter, withBodyValidation, withExceptionHandler } from '../../utils/express-helpers';
import { transformValues } from '../../utils/helpers';
import {
  nonEmptyStringsListSchema,
  hostnamesListSchema,
  adProvidersByDomainsRulesDictionarySchema,
  adProvidersDictionarySchema
} from '../../utils/schemas';

/**
 * @swagger
 * tags:
 *   name: Known ads providers
 * components:
 *   schemas:
 *     AdProvidersByDomainRule:
 *       type: object
 *       required:
 *         - urlRegexes
 *         - providers
 *       properties:
 *         urlRegexes:
 *           type: array
 *           items:
 *             type: string
 *             format: regex
 *         providers:
 *           type: array
 *           items:
 *             type: string
 *       example:
 *         urlRegexes:
 *           - '^https://polygonscan\.com/?$'
 *         providers:
 *           - 'coinzilla'
 *           - 'bitmedia'
 *     AdProvidersByDomainsRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/AdProvidersByDomainRule'
 *       example:
 *         polygonscan.com:
 *           - urlRegexes:
 *               - '^https://polygonscan\.com/?$'
 *             providers:
 *               - 'coinzilla'
 *               - 'bitmedia'
 *     AdProvidersInputValue:
 *       allOf:
 *         - $ref: '#/components/schemas/ExtVersionConstraints'
 *         - type: object
 *           required:
 *             - selectors
 *           properties:
 *             selectors:
 *               type: array
 *               items:
 *                 type: string
 *     AdProvidersDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           type: string
 *       example:
 *         google:
 *           - '#Ads_google_bottom_wide'
 *           - '.GoogleAdInfo'
 *           - 'a[href^="https://googleads.g.doubleclick.net/pcs/click"]'
 *     AdProvidersInputsDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/AdProvidersInputValue'
 */

export const adProvidersRouter = Router();

/**
 * @swagger
 * /api/slise-ad-rules/providers/all-sites:
 *   get:
 *     summary: Get providers of ads for which ads should be replaced at all sites
 *     tags:
 *       - Known ads providers
 *     responses:
 *       '200':
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example:
 *                 - 'coinzilla'
 *                 - 'bitmedia'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: >
 *       Add providers of ads for which ads should be replaced at all sites. They will not be removed
 *       from lists of providers from specific sites. Checks for providers existence are not performed
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of providers
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
 *   delete:
 *     summary: Remove providers of ads for which ads should be replaced at all sites
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of providers
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *           example:
 *             - 'coinzilla'
 *             - 'bitmedia'
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
adProvidersRouter
  .route('/all-sites')
  .get(
    withExceptionHandler(async (_req, res) => {
      const providers = await getAdProvidersForAllSites();

      res.status(200).header('Cache-Control', 'public, max-age=300').send(providers);
    })
  )
  .post(
    basicAuth,
    withExceptionHandler(
      withBodyValidation(nonEmptyStringsListSchema, async (req, res) => {
        const providersAddedCount = await addAdProvidersForAllSites(req.body);

        res.status(200).send({ message: `${providersAddedCount} providers have been added` });
      })
    )
  )
  .delete(
    basicAuth,
    withExceptionHandler(
      withBodyValidation(nonEmptyStringsListSchema, async (req, res) => {
        const providersRemovedCount = await removeAdProvidersForAllSites(req.body);

        res.status(200).send({ message: `${providersRemovedCount} providers have been removed` });
      })
    )
  );

/**
 * @swagger
 * /api/slise-ad-rules/providers/by-sites/{domain}:
 *   get:
 *     summary: Get rules for providers of ads for which ads should be replaced at the specified site
 *     tags:
 *       - Known ads providers
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
 *                 $ref: '#/components/schemas/AdProvidersByDomainRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/providers/by-sites:
 *   get:
 *     summary: Get rules for providers of ads for which ads should be replaced at all sites
 *     tags:
 *       - Known ads providers
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdProvidersByDomainsRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: >
 *       Add rules for providers of ads for the specified sites. They will not be removed from lists
 *       of providers from all sites. Checks for providers existence are not performed
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdProvidersByDomainsRulesDictionary'
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
 *     summary: Remove rules for providers of ads for the specified sites
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of domains
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *               format: hostname
 *             example:
 *               - 'goerli.etherscan.io'
 *               - 'polygonscan.com'
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
addObjectStorageMethodsToRouter<AdProvidersByDomainRule[]>(adProvidersRouter, {
  path: '/by-sites',
  methods: adProvidersByDomainRulesMethods,
  keyName: 'domain',
  objectValidationSchema: adProvidersByDomainsRulesDictionarySchema,
  keysArrayValidationSchema: hostnamesListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} entries have been removed`,
  valueTransformFn: identity,
  objectTransformFn: identity
});

/**
 * @swagger
 * /api/slise-ad-rules/providers/raw/all:
 *   get:
 *     summary: Get selectors for all providers and all extensions versions
 *     tags:
 *       - Known ads providers
 *     responses:
 *       '200':
 *         description: Provider - selectors dictionary
 *         content:
 *           application/json:
 *             schema:
 *              $ref: '#/components/schemas/AdProvidersInputsDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/providers/{providerId}/raw:
 *   get:
 *     summary: Get selectors for a provider for all extensions versions
 *     tags:
 *       - Known ads providers
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *         example: 'google'
 *     responses:
 *       '200':
 *         description: Lists of CSS selectors for all extension versions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                  $ref: '#/components/schemas/AdProvidersInputValue'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/providers/{providerId}:
 *   get:
 *     summary: Get selectors for a provider filtered by extension version
 *     tags:
 *       - Known ads providers
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *         example: 'google'
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
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
 *                 - '#Ads_google_bottom_wide'
 *                 - '.GoogleAdInfo'
 *                 - 'a[href^="https://googleads.g.doubleclick.net/pcs/click"]'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/providers:
 *   get:
 *     summary: Get selectors for all providers filtered by extension version
 *     tags:
 *       - Known ads providers
 *     parameters:
 *       - in: query
 *         name: extVersion
 *         schema:
 *           type: string
 *           default: '0.0.0'
 *         description: The extension version for which the rules should be returned
 *     responses:
 *       '200':
 *         description: Provider - selectors dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdProvidersDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Upserts providers. Providers that have existed before will be overwritten
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Provider - selectors dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdProvidersInputsDictionary'
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
 *     summary: Delete specified providers. Cascade delete rules are not applied
 *     tags:
 *       - Known ads providers
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: List of provider IDs to delete
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *           example:
 *             - 'coinzilla'
 *             - 'bitmedia'
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
const transformAdProviderSelectorsRules = (rules: AdProviderSelectorsRule[], req: Request) =>
  Array.from(
    new Set(
      filterByVersion(rules, req.query.extVersion as string | undefined)
        .map(({ selectors }) => selectors)
        .flat()
    )
  );

addObjectStorageMethodsToRouter<AdProviderSelectorsRule[], Record<string, string[]>, string[]>(adProvidersRouter, {
  path: '/',
  methods: adProvidersMethods,
  keyName: 'providerId',
  objectValidationSchema: adProvidersDictionarySchema,
  keysArrayValidationSchema: nonEmptyStringsListSchema,
  successfulRemovalMessage: entriesCount => `${entriesCount} providers have been removed`,
  valueTransformFn: transformAdProviderSelectorsRules,
  objectTransformFn: (rules, req) => transformValues(rules, value => transformAdProviderSelectorsRules(value, req))
});
