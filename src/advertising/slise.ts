import { redisClient } from '../redis';
import { isDefined } from '../utils/helpers';

export interface SliseAdContainerRule {
  urlRegexes: string[];
  selector: {
    isMultiple: boolean;
    cssString: string;
    shouldUseResultParent: boolean;
  };
}

const SLISE_AD_CONTAINERS_RULES_KEY = 'slise_ad_containers_rules';
const SLISE_HEURISTIC_URL_REGEXES_KEY = 'slise_heuristic_url_regexes_key';
const SLISE_HEURISTIC_SELECTORS_KEY = 'slise_heuristic_selectors_key';

export const getSliseAdContainerRulesByDomain = async (domain: string) => {
  const rule = await redisClient.hget(SLISE_AD_CONTAINERS_RULES_KEY, domain);

  return isDefined(rule)
    ? (JSON.parse(rule) as SliseAdContainerRule[])
    : [
        {
          urlRegexes: [],
          selector: {
            isMultiple: false,
            cssString: '*',
            shouldUseResultParent: false
          }
        }
      ];
};

export const getAllSliseAdContainerRules = async () => {
  const rules = await redisClient.hgetall(SLISE_AD_CONTAINERS_RULES_KEY);

  const parsedRules: { [domain: string]: SliseAdContainerRule[] } = {};
  for (const domainName in rules) {
    parsedRules[domainName] = JSON.parse(rules[domainName]);
  }

  return parsedRules;
};

export const upsertSliseAdContainerRules = async (rules: Record<string, SliseAdContainerRule[]>) => {
  // Failed to set the arrays as values in Redis, so stringifying them
  await redisClient.hmset(
    SLISE_AD_CONTAINERS_RULES_KEY,
    Object.fromEntries(Object.entries(rules).map(([domain, rules]) => [domain, JSON.stringify(rules)]))
  );
};

export const removeSliseAdContainerRules = async (domains: string[]) =>
  redisClient.hdel(SLISE_AD_CONTAINERS_RULES_KEY, ...domains);

export const getSliseHeuristicUrlRegexes = async () => redisClient.smembers(SLISE_HEURISTIC_URL_REGEXES_KEY);

export const addSliseHeuristicUrlRegexes = async (regexes: string[]) =>
  redisClient.sadd(SLISE_HEURISTIC_URL_REGEXES_KEY, ...regexes);

export const removeSliseHeuristicUrlRegexes = async (regexes: string[]) =>
  redisClient.srem(SLISE_HEURISTIC_URL_REGEXES_KEY, ...regexes);

export const getSliseHeuristicSelectors = async () => redisClient.smembers(SLISE_HEURISTIC_SELECTORS_KEY);

export const addSliseHeuristicSelectors = async (selectors: string[]) =>
  redisClient.sadd(SLISE_HEURISTIC_SELECTORS_KEY, ...selectors);

export const removeSliseHeuristicSelectors = async (selectors: string[]) =>
  redisClient.srem(SLISE_HEURISTIC_SELECTORS_KEY, ...selectors);
