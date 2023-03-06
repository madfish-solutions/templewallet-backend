import { isDefined } from './helpers';
import { blockQueryMainnet } from './tzkt';

const PAST_BLOCKS_DEPTH = 4;

export const getRecentDestinations = (currentBlockLevel: number) =>
  Promise.all(
    new Array(PAST_BLOCKS_DEPTH).fill(0).map(async (_, index) => {
      const pastBlockLevel = currentBlockLevel - index;

      const { transactions } = await blockQueryMainnet({ level: pastBlockLevel, operations: true });

      if (transactions) {
        return transactions
          .map(transaction => {
            if (transaction?.type === 'transaction') {
              return transaction.target?.address ?? undefined;
            }

            return undefined;
          })
          .filter((address): address is string => isDefined(address));
      }

      return [];
    })
  )
    .then(destinationsArray => destinationsArray.flat())
    .catch((error): string[] => {
      console.log('getRecentDestinations error', error);

      return [];
    });
