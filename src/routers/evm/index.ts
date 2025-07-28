import { Router } from 'express';

import { EnvVars } from '../../config';

export const evmRouter = Router();

evmRouter.use(async (req, res) => {
  res.redirect(307, `${EnvVars.EVM_API_URL}/api${req.url}`);
});
