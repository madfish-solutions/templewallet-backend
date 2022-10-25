import {aliceBobApi} from "../api.sevice";
import {AliceBobEstimateAmountPayload} from "../../interfaces/alice-bob/alice-bob.interfaces";
import { getAliceBobSignature } from "./get-alice-bob-signature";
import {getAliceBobRequestHeaders} from "./get-alice-bob-request-headers";

export const estimateAliceBobOutput = async (isWithdraw: boolean, payload: AliceBobEstimateAmountPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  const response = await aliceBobApi.post<{ toAmount: number, fromRate: number, toRate: number }>(
    '/estimate-amount',
    payload,
    {
      headers: getAliceBobRequestHeaders(signature, now)
    });

  return response.data.toAmount;
};
