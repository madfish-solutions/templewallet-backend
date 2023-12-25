import { Router } from 'express';

import { sliseAdPlacesRulesRouter } from './ad-places';
import { sliseAdProvidersRouter } from './providers';

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

export const sliseRulesRouter = Router();

sliseRulesRouter.use('/ad-places', sliseAdPlacesRulesRouter);
sliseRulesRouter.use('/providers', sliseAdProvidersRouter);
