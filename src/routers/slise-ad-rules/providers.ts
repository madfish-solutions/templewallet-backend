import { Router } from 'express';

import {
  addSliseAdProvidersForAllSites,
  getAllProviders,
  getAllSliseAdProvidersBySites,
  getSelectorsByProviderId,
  getSliseAdProvidersByDomain,
  getSliseAdProvidersForAllSites,
  removeProviders,
  removeSliseAdProvidersBySites,
  removeSliseAdProvidersForAllSites,
  upsertProviders,
  upsertSliseAdProvidersBySites
} from '../../advertising/slise';
import { basicAuth } from '../../middlewares/basic-auth.middleware';
import { addObjectStorageMethodsToRouter, withBodyValidation, withExceptionHandler } from '../../utils/express-helpers';
import {
  adTypesListSchema,
  hostnamesListSchema,
  sliseAdProvidersByDomainsRulesDictionarySchema,
  sliseAdProvidersDictionarySchema
} from '../../utils/schemas';

/**
 * @swagger
 * components:
 *   schemas:
 *     SliseAdProvidersByDomainRule:
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
 *     SliseAdProvidersByDomainsRulesDictionary:
 *       type: object
 *       additionalProperties:
 *         type: array
 *         items:
 *           $ref: '#/components/schemas/SliseAdProvidersByDomainRule'
 *       example:
 *         polygonscan.com:
 *           - urlRegexes:
 *               - '^https://polygonscan\.com/?$'
 *             providers:
 *               - 'coinzilla'
 *               - 'bitmedia'
 *     SliseAdProvidersDictionary:
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
 */

export const sliseAdProvidersRouter = Router();

/**
 * @swagger
 * /api/slise-ad-rules/providers/all-sites:
 *   get:
 *     summary: Get providers of ads for which ads should be replaced at all sites
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
sliseAdProvidersRouter
  .route('/all-sites')
  .get(
    withExceptionHandler(async (_req, res) => {
      const providers = await getSliseAdProvidersForAllSites();

      res.status(200).send(providers);
    })
  )
  .post(
    basicAuth,
    withExceptionHandler(
      withBodyValidation(adTypesListSchema, async (req, res) => {
        const providersAddedCount = await addSliseAdProvidersForAllSites(req.body);

        res.status(200).send({ message: `${providersAddedCount} providers have been added` });
      })
    )
  )
  .delete(
    basicAuth,
    withExceptionHandler(
      withBodyValidation(adTypesListSchema, async (req, res) => {
        const providersRemovedCount = await removeSliseAdProvidersForAllSites(req.body);

        res.status(200).send({ message: `${providersRemovedCount} providers have been removed` });
      })
    )
  );

/**
 * @swagger
 * /api/slise-ad-rules/providers/by-sites/{domain}:
 *   get:
 *     summary: Get rules for providers of ads for which ads should be replaced at the specified site
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
 *                 $ref: '#/components/schemas/SliseAdProvidersByDomainRule'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 * /api/slise-ad-rules/providers/by-sites:
 *   get:
 *     summary: Get rules for providers of ads for which ads should be replaced at all sites
 *     responses:
 *       '200':
 *         description: Domain - rules list dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdProvidersByDomainsRulesDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: >
 *       Add rules for providers of ads for the specified sites. They will not be removed from lists
 *       of providers from all sites. Checks for providers existence are not performed
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Domain - rules list dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SliseAdProvidersByDomainsRulesDictionary'
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
addObjectStorageMethodsToRouter(
  sliseAdProvidersRouter,
  '/by-sites',
  {
    getAllValues: getAllSliseAdProvidersBySites,
    getByKey: getSliseAdProvidersByDomain,
    upsertValues: upsertSliseAdProvidersBySites,
    removeValues: removeSliseAdProvidersBySites
  },
  'domain',
  sliseAdProvidersByDomainsRulesDictionarySchema,
  hostnamesListSchema,
  entriesCount => `${entriesCount} entries have been removed`
);

/**
 * @swagger
 * /api/slise-ad-rules/providers/{providerId}:
 *   get:
 *     summary: Get selectors for a provider
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *         example: 'google'
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
 *     summary: Get all providers
 *     responses:
 *       '200':
 *         description: Provider - selectors dictionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SliseAdProvidersDictionary'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Upserts providers. Providers that have existed before will be overwritten
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       description: Provider - selectors dictionary
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SliseAdProvidersDictionary'
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
addObjectStorageMethodsToRouter(
  sliseAdProvidersRouter,
  '/',
  {
    getAllValues: getAllProviders,
    getByKey: getSelectorsByProviderId,
    upsertValues: upsertProviders,
    removeValues: removeProviders
  },
  'providerId',
  sliseAdProvidersDictionarySchema,
  adTypesListSchema,
  entriesCount => `${entriesCount} providers have been removed`
);
