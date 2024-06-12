import { Router } from 'express';

import { adCategoryRouter } from './ad-category';
import { adPlacesRulesRouter } from './ad-places';
import { adProvidersRouter } from './providers';
import { replaceUrlsBlacklistRouter } from './replace-urls-blacklist';

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
 */

export const adRulesRouter = Router();

adRulesRouter.use('/ad-category', adCategoryRouter);
adRulesRouter.use('/ad-places', adPlacesRulesRouter);
adRulesRouter.use('/providers', adProvidersRouter);
adRulesRouter.use('/replace-urls-blacklist', replaceUrlsBlacklistRouter);
