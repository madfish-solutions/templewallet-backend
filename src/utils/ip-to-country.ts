import axios from 'axios';

export const getCountryCodeByIP = async (ip: string) => {
  const { data } = await axios.get<{ country_code: string }>(`https://ipapi.co/${ip}/json`);

  return data.country_code;
};
