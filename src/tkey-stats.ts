import axios from 'axios';
import memoizee from 'memoizee';

const BURN_ADDRESS = 'tz1burnburnburnburnburnburnburjAYjjX';
const INCENTIVES_ADDRESS = 'tz1Ntpk55Q6AVJHVrCs1uN4HyTTxBbVMFZcb';
const INVESTMENT_ADDRESS = 'tz1imUX3aTc4HX6KygaQUe8e1sQqYvGs6eCF';
const DEVELOPER_REWARDS_ADDRESS = 'tz1bxHEHAtKubVy44vBDFVEZ1iqYPYdJVS9U';
const CONTRACT = 'KT1VaEsVNiBoA56eToEK6n6BcPgh1tdx9eXi';
const DECIMALS = 18n;
const TOTAL_SUPPLY = 14_000_000_000_000_000_000_000_000n;
const TOTAL_SUPPLY_WITH_DECIMALS = TOTAL_SUPPLY / 10n ** DECIMALS;

const getTkeyBalance = memoizee(
  async (holder: string) => {
    const response = await axios.get(
      `https://api.tzkt.io/v1/tokens/balances?account=${holder}&token.contract=${CONTRACT}`
    );

    return BigInt(response.data[0].balance) / 10n ** DECIMALS;
  },
  {
    maxAge: 1000 * 60 * 60 // 1 hour
  }
);

const getBurnedTokens = () => getTkeyBalance(BURN_ADDRESS);
const getInvestmentFund = () => getTkeyBalance(INVESTMENT_ADDRESS);
const getIncentivesFund = () => getTkeyBalance(INCENTIVES_ADDRESS);
const getDeveloperRewardsFund = () => getTkeyBalance(DEVELOPER_REWARDS_ADDRESS);

export const getTkeyStats = memoizee(
  async () => {
    const burned = await getBurnedTokens();
    const incentives = await getIncentivesFund();
    const investment = await getInvestmentFund();
    const developerRewards = await getDeveloperRewardsFund();

    const circulating = TOTAL_SUPPLY_WITH_DECIMALS - incentives - developerRewards - investment - burned;

    return {
      incentivesFund: incentives.toString(),
      investmentFund: investment.toString(),
      developerRewardsFund: developerRewards.toString(),
      totalSupply: TOTAL_SUPPLY_WITH_DECIMALS.toString(),
      circulating: circulating.toString(),
      burned: burned.toString()
    };
  },
  {
    maxAge: 1000 * 60 * 60 // 1 hour
  }
);
