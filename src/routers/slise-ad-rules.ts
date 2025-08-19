import { Router } from 'express';

import { addTempleAdsRedirection } from '../utils/temple-ads-redirection';

export const adRulesRouter = Router();

addTempleAdsRedirection(adRulesRouter, '/ad-places/permanent-native', true);
addTempleAdsRedirection(adRulesRouter, '/ad-places/permanent', false);
addTempleAdsRedirection(adRulesRouter, '/ad-places', false, '/ad-places/replace');

addTempleAdsRedirection(adRulesRouter, '/providers/all-sites', false);
addTempleAdsRedirection(adRulesRouter, '/providers/by-sites', false);
addTempleAdsRedirection(adRulesRouter, '/providers/categories', false);
addTempleAdsRedirection(adRulesRouter, '/providers/negative-selectors', false);
addTempleAdsRedirection(adRulesRouter, '/providers', true, '/providers/selectors');

addTempleAdsRedirection(adRulesRouter, '/replace-urls-blacklist', false);
addTempleAdsRedirection(adRulesRouter, '/elements-to-hide-or-remove', false);
