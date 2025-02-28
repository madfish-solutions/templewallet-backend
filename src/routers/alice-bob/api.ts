import axios from 'axios';

export const aliceBobApi = axios.create({ baseURL: 'https://api.abex.pro/api/v3' });
