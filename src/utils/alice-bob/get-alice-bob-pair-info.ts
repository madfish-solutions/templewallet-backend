import {aliceBobApi} from "../api.sevice";
import {AliceBobPairInfo} from "../../interfaces/alice-bob/alice-bob.interfaces";
import {getAliceBobSignature} from "./get-alice-bob-signature";
import {getAliceBobRequestHeaders} from "./get-alice-bob-request-headers";

export const getAliceBobPairInfo = async (isWithdraw = false) => {
  const pair = isWithdraw ? 'TEZ/CARDUAH' : 'CARDUAH/TEZ';

  const { signature, now } = getAliceBobSignature();

  const response = await aliceBobApi.get<AliceBobPairInfo>(
    '/get-pair-info/' + pair,
    {
      headers: getAliceBobRequestHeaders(signature, now)
    });

  return { minAmount: response.data.minamount, maxAmount: response.data.maxamount };
};
