import { ParsedQs } from 'qs';

type QueryParam = string | ParsedQs | string[] | ParsedQs[] | undefined;

export const getEstimationPayload = (from: QueryParam, to: QueryParam, amount: QueryParam) => ({
  from: String(from),
  to: String(to),
  fromAmount: Number(amount)
});
