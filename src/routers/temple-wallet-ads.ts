import { Router } from 'express';

import { addTempleAdsRedirection } from '../utils/temple-ads-redirection';

export const templeWalletAdsRouter = Router();

addTempleAdsRedirection(templeWalletAdsRouter, '/hypelab-campaigns-blacklist', false);
