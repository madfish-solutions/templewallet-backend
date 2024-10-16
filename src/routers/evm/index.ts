import { Router } from 'express';

import { withCodedExceptionHandler } from '../../utils/express-helpers';
import {
  evmQueryParamsSchema,
  evmQueryParamsPaginatedSchema,
  evmQueryParamsTransfersSchema
} from '../../utils/schemas';
import {
  getEvmBalances,
  getEvmCollectiblesMetadata,
  getEvmTokensMetadata,
  getEvmAccountTransactions,
  getEvmAccountERC20Transfers
} from './covalent';

export const evmRouter = Router();

evmRouter
  .get(
    '/balances',
    withCodedExceptionHandler(async (req, res) => {
      const { walletAddress, chainId } = await evmQueryParamsSchema.validate(req.query);

      const data = await getEvmBalances(walletAddress, chainId);

      res.status(200).send(data);
    })
  )
  .get(
    '/tokens-metadata',
    withCodedExceptionHandler(async (req, res) => {
      const { walletAddress, chainId } = await evmQueryParamsSchema.validate(req.query);

      const data = await getEvmTokensMetadata(walletAddress, chainId);

      res.status(200).send(data);
    })
  )
  .get(
    '/collectibles-metadata',
    withCodedExceptionHandler(async (req, res) => {
      const { walletAddress, chainId } = await evmQueryParamsSchema.validate(req.query);

      const data = await getEvmCollectiblesMetadata(walletAddress, chainId);

      res.status(200).send(data);
    })
  )
  .get(
    '/transactions',
    withCodedExceptionHandler(async (req, res) => {
      const { walletAddress, chainId, page } = await evmQueryParamsPaginatedSchema.validate(req.query);

      const data = await getEvmAccountTransactions(walletAddress, chainId, page);

      res.status(200).send(data);
    })
  )
  .get(
    '/erc20-transfers',
    withCodedExceptionHandler(async (req, res) => {
      const { walletAddress, chainId, contractAddress, page } = await evmQueryParamsTransfersSchema.validate(req.query);

      const data = await getEvmAccountERC20Transfers(walletAddress, chainId, contractAddress, page);

      res.status(200).send(data);
    })
  );
