import {AxiosError} from "axios";

import {aliceBobApi} from "../api.sevice";
import {AliceBobPairInfo} from "../../interfaces/alice-bob/alice-bob.interfaces";
import {getAliceBobSignature} from "./get-alice-bob-signature";
import {getAliceBobRequestHeaders} from "./get-alice-bob-request-headers";
import {estimateAliceBobOutput} from "./estimate-alice-bob-output";

export const getAliceBobPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const { signature, now } = getAliceBobSignature();

  const response = await aliceBobApi.get<AliceBobPairInfo>(
    '/get-pair-info/' + pair,
    {
      headers: getAliceBobRequestHeaders(signature, now)
    });

  /*
    Output estimation at AliceBob errors later with `maxAmount` used as input amount.
    Double-checking here, to have a valid `maxAmount` value.
  */

  let maxAmount = response.data.maxamount;

  if (isWithdraw === false) try {
    await estimateAliceBobOutput({
      from: 'CARDUAH',
      to: 'TEZ',
      fromAmount: maxAmount
    });
  }
  catch (error) {
    if (
      error instanceof AxiosError
      && error.response?.status === 400
      && error.response.data.errorCode === 'EXCEEDING_LIMITS'
    ) {
      const altMaxAmount = Number(error.response.data.maxAmount);
      if (Number.isFinite(altMaxAmount)) maxAmount = altMaxAmount;
    }
  }

  return { minAmount: response.data.minamount, maxAmount };
};
