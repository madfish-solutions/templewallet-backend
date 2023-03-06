import { isDefined } from './helpers';
import logger from './logger';
import { makeBlockQuery } from './tzkt';

const PAST_BLOCKS_DEPTH = 4;

export const getRecentDestinations = (currentBlockLevel: number) =>
  Promise.all(
    new Array(PAST_BLOCKS_DEPTH).fill(0).map(async (_, index) => {
      const pastBlockLevel = currentBlockLevel - index;

      const { transactions } = await makeBlockQuery({ level: pastBlockLevel, operations: true });

      if (isDefined(transactions)) {
        return transactions
          .map(transaction => {
            if (transaction?.type === 'transaction') {
              return transaction.target?.address ?? undefined;
            }

            return undefined;
          })
          .filter(isDefined);
      }

      return [];
    })
  ).then(
    destinationsArray => destinationsArray.flat(),
    (error): string[] => {
      logger.error('getRecentDestinations error:', error);

      return [];
    }
  );
