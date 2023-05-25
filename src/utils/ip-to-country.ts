import axios from 'axios';
import memoizee from 'memoizee';

const TWO_HOURS = 2 * 60 * 60_000;

export const getCountryCodeByIP = memoizee(
  async (ip: string) => {
    const { data } = await axios.get<{ country_code: string }>(`https://ipapi.co/${ip}/json`);

    return data.country_code;
  },
  { promise: true, maxAge: TWO_HOURS }
);
