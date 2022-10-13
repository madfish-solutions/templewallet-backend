import {aliceBobApi} from "../api.sevice";
import {getAliceBobSignature} from "./get-alice-bob-signature";
import {aliceBobOrder} from "../../interfaces/alice-bob/alice-bob.interfaces";
import {getAliceBobRequestHeaders} from "./get-alice-bob-request-headers";

export const getAliceBobOrders = async (userId: string) => {
  const { signature, now } = getAliceBobSignature();

  const response = await aliceBobApi.get<aliceBobOrder[]>(
      '/get-orders',
      {
        headers: getAliceBobRequestHeaders(signature, now),
        params: { userId }
      });

  return response.data;
};


