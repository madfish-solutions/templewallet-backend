import axios from 'axios';
import memoizee from 'memoizee';

const CONTRACT = 'KT1VaEsVNiBoA56eToEK6n6BcPgh1tdx9eXi';
const BURN_ADDRESS = 'tz1burnburnburnburnburnburnburjAYjjX';
const DECIMALS = 18n;
const TOTAL_SUPPLY = 14_000_000_000_000_000_000_000_000n;
const TOTAL_SUPPLY_WITH_DECIMALS = TOTAL_SUPPLY / 10n ** DECIMALS;

const INCENTIVES = 1_000_000n;
const INVESTMENT = 1_000_000n;
const DEVELOPER_REWARDS = 2_000_000n;

const getBurnedTokens = memoizee(
  async () => {
    const response = await axios.get(
      `https://api.tzkt.io/v1/tokens/balances?account=${BURN_ADDRESS}&token.contract=${CONTRACT}`
    );

    return BigInt(response.data[0].balance) / 10n ** DECIMALS;
  },
  {
    maxAge: 1000 * 60 * 60 // 1 hour
  }
);

export const getTkeyStats = memoizee(
  async () => {
    const burned = await getBurnedTokens();
    const circulating = TOTAL_SUPPLY_WITH_DECIMALS - INCENTIVES - DEVELOPER_REWARDS - INVESTMENT - burned;

    return {
      incentivesFund: INCENTIVES.toString(),
      investmentFund: INVESTMENT.toString(),
      developerRewardsFund: DEVELOPER_REWARDS.toString(),
      totalSupply: TOTAL_SUPPLY_WITH_DECIMALS.toString(),
      circulatingSupply: circulating.toString(),
      burned: burned.toString()
    };
  },
  {
    maxAge: 1000 * 60 * 60 // 1 hour
  }
);
