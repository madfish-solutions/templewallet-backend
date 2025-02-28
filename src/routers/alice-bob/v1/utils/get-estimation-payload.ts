import { ParsedQs } from 'qs';

import { isDefined } from '../../../../utils/helpers';

type QueryParam = string | ParsedQs | string[] | ParsedQs[] | undefined;

export const getEstimationPayload = (isWithdraw: QueryParam, from: QueryParam, to: QueryParam, amount: QueryParam) => {
  const booleanIsWithdraw = isWithdraw === 'true';

  return {
    from: isDefined(isWithdraw) ? (booleanIsWithdraw ? 'TEZ' : 'CARDUAH') : String(from),
    to: isDefined(isWithdraw) ? (booleanIsWithdraw ? 'CARDUAH' : 'TEZ') : String(to),
    fromAmount: Number(amount)
  };
};
