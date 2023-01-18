export interface IPriceitem {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}
export interface IPriceHistory {
  priceHistories: Array<IPriceitem>;
}
