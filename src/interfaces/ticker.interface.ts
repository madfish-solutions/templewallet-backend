export interface ITicker {
  pair: string;
  base: string;
  quote: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  last: number;
  change: number;
  vwap: number;
  n_trades: number;
  volume_base: number;
  volume_quote: number;
  timestamp: string;
}
