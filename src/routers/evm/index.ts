import { Router } from 'express';

import { withCodedExceptionHandler, withEvmQueryValidation } from '../../utils/express-helpers';
import { getEvmBalances, getEvmCollectiblesMetadata, getEvmTokensMetadata, getStringifiedResponse } from './covalent';

export const evmRouter = Router();

evmRouter
  .get(
    '/balances',
    withCodedExceptionHandler(
      withEvmQueryValidation(async (_1, res, _2, evmQueryParams) => {
        const { walletAddress, chainId } = evmQueryParams;

        const data = await getEvmBalances(walletAddress, chainId);

        res.status(200).send(getStringifiedResponse(data));
      })
    )
  )
  .get(
    '/tokens-metadata',
    withCodedExceptionHandler(
      withEvmQueryValidation(async (_1, res, _2, evmQueryParams) => {
        const { walletAddress, chainId } = evmQueryParams;

        const data = await getEvmTokensMetadata(walletAddress, chainId);

        res.status(200).send(getStringifiedResponse(data));
      })
    )
  )
  .get(
    '/collectibles-metadata',
    withCodedExceptionHandler(
      withEvmQueryValidation(async (_1, res, _2, evmQueryParams) => {
        const { walletAddress, chainId } = evmQueryParams;

        const data = await getEvmCollectiblesMetadata(walletAddress, chainId);

        res.status(200).send(getStringifiedResponse(data));
      })
    )
  );
