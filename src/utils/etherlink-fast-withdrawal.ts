import axios from 'axios';

const FAST_WITHDRAWAL_RATES_URL =
  'https://fast-withdrawal-liquidity-monitor-481945595089.europe-west2.run.app/api/wallets/read';

export const getFastWithdrawalProviders = () =>
  axios
    .post<unknown>(FAST_WITHDRAWAL_RATES_URL, { network: 0, numberOfLiquidityProviders: 10 }, { timeout: 10_000 })
    .then(res => res.data);
