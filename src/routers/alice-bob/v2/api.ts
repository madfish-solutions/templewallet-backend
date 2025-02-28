import axios from 'axios';

export const aliceBobV2Api = axios.create({ baseURL: 'https://api.swapple.org/api/v3' });
