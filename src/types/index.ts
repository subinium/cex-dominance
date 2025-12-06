export interface VolumeData {
  date: string;
  exchange: string;
  symbol: string;
  volumeBase: number;
  volumeUsd: number;
  open: number;
  high: number;
  low: number;
  close: number;
  type: 'spot' | 'perp';
  marketSharePct?: number;
}

export interface MarketShareData {
  date: string;
  exchange: string;
  volumeUsd: number;
  marketSharePct: number;
  close: number;
}

export interface DailyData {
  date: string;
  [exchange: string]: number | string;
}

export interface ExchangeInfo {
  name: string;
  color: string;
  isKrw: boolean;
}

export interface ApiResponse {
  success: boolean;
  data?: VolumeData[];
  currentPrice?: number;
  error?: string;
}

export interface ChartData {
  dominance: DailyData[];
  volume: DailyData[];
  price: { date: string; close: number }[];
  exchanges: string[];
}

export const EXCHANGE_COLORS: Record<string, string> = {
  binance: '#F3BA2F',
  coinbase: '#0052FF',
  upbit: '#1C64F2',
  bithumb: '#FF5C5C',
  kraken: '#5546FF',
  okx: '#C08040',
  bybit: '#F9D326',
  kucoin: '#28C893',
};

export const KRW_EXCHANGES = ['upbit', 'bithumb'];
export const NON_KRW_EXCHANGES = ['binance', 'bybit', 'okx', 'kucoin', 'coinbase', 'kraken'];

export const EXCHANGES: ExchangeInfo[] = [
  { name: 'binance', color: '#F3BA2F', isKrw: false },
  { name: 'coinbase', color: '#0052FF', isKrw: false },
  { name: 'upbit', color: '#1C64F2', isKrw: true },
  { name: 'bithumb', color: '#FF5C5C', isKrw: true },
  { name: 'kraken', color: '#5546FF', isKrw: false },
  { name: 'okx', color: '#C08040', isKrw: false },
  { name: 'bybit', color: '#F9D326', isKrw: false },
  { name: 'kucoin', color: '#28C893', isKrw: false },
];
