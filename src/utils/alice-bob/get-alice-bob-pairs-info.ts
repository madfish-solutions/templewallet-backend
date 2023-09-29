import { AxiosError } from 'axios';

import { AliceBobPairInfo } from '../../interfaces/alice-bob.interfaces';
import { aliceBobApi } from '../api.sevice';
import { estimateAliceBobOutput } from './estimate-alice-bob-output';
import { getAliceBobRequestHeaders } from './get-alice-bob-request-headers';
import { getAliceBobSignature } from './get-alice-bob-signature';

export const getAliceBobPairsInfo = async (isWithdraw = false) => {
  const { signature, now } = getAliceBobSignature();

  const { data } = await aliceBobApi.get<AliceBobPairInfo[]>('/get-pairs-info', {
    headers: getAliceBobRequestHeaders(signature, now)
  });

  const pairsInfo = data.filter(pair => (isWithdraw ? pair.from === 'TEZ' : pair.from !== 'TEZ'));

  /*
    Output estimation at AliceBob errors later with `maxAmount` used as input amount.
    Double-checking here, to have a valid `maxAmount` value.
  */
  if (!isWithdraw) {
    const finalPairsInfo: AliceBobPairInfo[] = [];

    for (let i = 0; i < pairsInfo.length; i++) {
      const currentPair = pairsInfo[i];

      const [maxAmountString, currencyCode] = currentPair.maxamount.split(' ');
      let maxAmount = Number(maxAmountString);

      try {
        await estimateAliceBobOutput({
          from: currentPair.from,
          to: 'TEZ',
          fromAmount: maxAmount
        });
      } catch (error) {
        if (
          error instanceof AxiosError &&
          error.response?.status === 400 &&
          error.response.data.errorCode === 'EXCEEDING_LIMITS'
        ) {
          const altMaxAmount = Number(error.response.data.maxAmount);
          if (Number.isFinite(altMaxAmount)) maxAmount = altMaxAmount;
        }
      }

      finalPairsInfo.push({
        ...currentPair,
        maxamount: `${maxAmount} ${currencyCode}`
      });
    }

    return finalPairsInfo;
  }

  return pairsInfo;
};
