import { BlockResponse, BlockFullHeader } from '@taquito/rpc';

import { sleep } from './helpers';
import logger from './logger';
import { mainnetToolkit } from './tezos';

export interface BlockInterface extends Pick<BlockResponse, 'protocol' | 'chain_id' | 'hash'> {
  header: Pick<BlockFullHeader, 'level' | 'timestamp'>;
}

export const EMPTY_BLOCK: BlockInterface = {
  protocol: '',
  chain_id: '',
  hash: '',
  header: {
    level: 0,
    timestamp: ''
  }
};

export const blockFinder = async (
  prevBlock: BlockInterface,
  onNewBlock: (block: BlockInterface) => Promise<unknown>
): Promise<unknown> => {
  const block = await mainnetToolkit.rpc
    .getBlock()
    .then(
      (blockResponse): BlockInterface => ({
        protocol: blockResponse.protocol,
        chain_id: blockResponse.chain_id,
        hash: blockResponse.hash,
        header: {
          level: blockResponse.header.level,
          timestamp: blockResponse.header.timestamp
        }
      })
    )
    .catch(e => {
      logger.error(e);

      return prevBlock;
    });

  const isNewBlock = block.header.level > prevBlock.header.level;
  const realBlock = isNewBlock ? block : prevBlock;

  if (isNewBlock) {
    await onNewBlock(realBlock).catch(e => {
      logger.error('blockFinder error');
      logger.error(e);
    });
  } else {
    await sleep(200);
  }

  return blockFinder(realBlock, onNewBlock);
};
