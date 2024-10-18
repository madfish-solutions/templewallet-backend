import { Router } from 'express';

import { hypelabCampaignsBlacklistMethods } from '../advertising/external-ads';
import { addSetStorageMethodsToRouter } from '../utils/express-helpers';
import { nonEmptyStringsListSchema } from '../utils/schemas';

export const templeWalletAdsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Temple Wallet Ads
 * /api/temple-wallet-ads/hypelab-campaigns-blacklist:
 *   get:
 *     summary: Get the list of blacklisted Hypelab campaigns slugs
 *     tags:
 *       - Temple Wallet Ads
 *     responses:
 *       '200':
 *         description: List of blacklisted Hypelab campaigns slugs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example:
 *                 - '3896abb03b'
 *       '500':
 *         $ref: '#/components/responses/ErrorResponse'
 *   post:
 *     summary: Add Hypelab campaigns slugs to the blacklist
 *     tags:
 *       - Temple Wallet Ads
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example:
 *               - '3896abb03b'
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
 *     summary: Remove Hypelab campaigns slugs from the blacklist
 *     tags:
 *       - Temple Wallet Ads
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example:
 *               - '3896abb03b'
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
addSetStorageMethodsToRouter(templeWalletAdsRouter, {
  path: '/hypelab-campaigns-blacklist',
  methods: hypelabCampaignsBlacklistMethods,
  arrayValidationSchema: nonEmptyStringsListSchema,
  successfulAdditionMessage: slugs => `Added ${slugs} slugs to the blacklist`,
  successfulRemovalMessage: slugs => `Removed ${slugs} slugs from the blacklist`
});
