import {aliceBobApi} from "../api.sevice";
import {getAliceBobSignature} from "./get-alice-bob-signature";
import {AliceBobCreateOrderPayload, aliceBobOrder} from "../../interfaces/alice-bob/alice-bob.interfaces";
import {getAliceBobRequestHeaders} from "./get-alice-bob-request-headers";

export const createAliceBobOrder = async (isWithdraw: boolean, payload: AliceBobCreateOrderPayload) => {
  const { signature, now } = getAliceBobSignature(payload);

  const response = await aliceBobApi.post<aliceBobOrder>(
      '/create-order',
      payload,
      {
        headers: getAliceBobRequestHeaders(signature, now)
      });

  return response.data;
};


