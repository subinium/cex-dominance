import ccxt from 'ccxt';
import { VolumeData } from '@/types';

const KRW_USD_RATE = 1350;

// Cache for exchange instances
let spotExchangeCache: Record<string, unknown> | null = null;
let futuresExchangeCache: Record<string, unknown> | null = null;

interface ExchangeConfig {
  enableRateLimit: boolean;
  timeout: number;
  rateLimit: number;
  options?: Record<string, unknown>;
}

const commonConfig: ExchangeConfig = {
  enableRateLimit: true,
  timeout: 20000,
  rateLimit: 200,
  options: {
    defaultType: 'spot',
    adjustForTimeDifference: true,
  },
};

// Returns array of pairs for each exchange (some exchanges have multiple pairs)
const spotPairs: Record<string, (coin: string) => string[]> = {
  binance: (coin) => [`${coin}/USDT`, `${coin}/USDC`, `${coin}/FDUSD`],
  coinbase: (coin) => [`${coin}/USD`, `${coin}/USDT`],
  upbit: (coin) => [`${coin}/KRW`],
  bithumb: (coin) => [`${coin}/KRW`],
  okx: (coin) => [`${coin}/USDT`, `${coin}/USDC`],
  kraken: (coin) => [`${coin}/USDT`, `${coin}/USD`],
  bybit: (coin) => [`${coin}/USDT`, `${coin}/USDC`],
  kucoin: (coin) => [`${coin}/USDT`],
};

const perpPairs: Record<string, (coin: string) => string[]> = {
  binance: (coin) => [`${coin}/USDT`, `${coin}/USDC`],
  okx: (coin) => [`${coin}/USDT`],
  bybit: (coin) => [`${coin}/USDT`],
  kucoin: (coin) => [`${coin}/USDT`],
};

// Track successfully fetched pairs
export interface FetchedPair {
  exchange: string;
  symbol: string;
  type: 'spot' | 'perp';
  records: number;
}

let lastFetchedPairs: FetchedPair[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSpotExchanges(): Record<string, any> {
  if (spotExchangeCache) return spotExchangeCache;

  spotExchangeCache = {
    binance: new ccxt.binance({ ...commonConfig, rateLimit: 300 }),
    coinbase: new ccxt.coinbase({ ...commonConfig, options: { ...commonConfig.options, sandbox: false } }),
    upbit: new ccxt.upbit(commonConfig),
    bithumb: new ccxt.bithumb(commonConfig),
    kraken: new ccxt.kraken(commonConfig),
    okx: new ccxt.okx(commonConfig),
    bybit: new ccxt.bybit({ ...commonConfig, rateLimit: 300 }),
    kucoin: new ccxt.kucoin(commonConfig),
  };
  return spotExchangeCache;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createFuturesExchanges(): Record<string, any> {
  if (futuresExchangeCache) return futuresExchangeCache;

  futuresExchangeCache = {
    binance: new ccxt.binance({ ...commonConfig, rateLimit: 300, options: { defaultType: 'future' } }),
    okx: new ccxt.okx({ ...commonConfig, options: { defaultType: 'swap' } }),
    bybit: new ccxt.bybit({ ...commonConfig, rateLimit: 300, options: { defaultType: 'linear' } }),
    kucoin: new ccxt.kucoin({ ...commonConfig, options: { defaultType: 'swap' } }),
  };
  return futuresExchangeCache;
}

async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 500
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`Failed after ${maxRetries} attempts:`, error);
        return null;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}

// Fetch single exchange data
async function fetchExchangeData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchange: any,
  exchangeName: string,
  symbol: string,
  days: number,
  isPerp = false
): Promise<VolumeData[]> {
  const results: VolumeData[] = [];

  try {
    // Skip loadMarkets - directly try to fetch OHLCV
    const ohlcv = await retryRequest<number[][]>(() =>
      exchange.fetchOHLCV(symbol, '1d', undefined, days)
    );

    if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) {
      return results;
    }

    for (const candle of ohlcv) {
      const [timestamp, open, high, low, close, volume] = candle;

      let date: Date;
      if (exchangeName === 'bithumb') {
        date = new Date((timestamp as number) + 9 * 3600 * 1000);
      } else {
        date = new Date(timestamp as number);
      }

      const dateStr = date.toISOString().split('T')[0];

      let volumeUsd: number;
      if (symbol.endsWith('/KRW')) {
        volumeUsd = ((volume as number) * (close as number)) / KRW_USD_RATE;
      } else {
        volumeUsd = (volume as number) * (close as number);
      }

      results.push({
        date: dateStr,
        exchange: isPerp ? `${exchangeName}_perp` : exchangeName,
        symbol,
        volumeBase: volume as number,
        volumeUsd,
        open: open as number,
        high: high as number,
        low: low as number,
        close: close as number,
        type: isPerp ? 'perp' : 'spot',
      });
    }

    console.log(`✅ ${exchangeName}${isPerp ? ' perp' : ''}: ${ohlcv.length} records`);
  } catch (error) {
    // Check for geo-blocking or access denied errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('403') || errorMessage.includes('blocked') ||
        errorMessage.includes('Forbidden') || errorMessage.includes('access denied')) {
      console.warn(`⚠️ ${exchangeName}${isPerp ? ' perp' : ''}: Geo-blocked or access denied (common on serverless platforms)`);
    } else {
      console.error(`❌ ${exchangeName}${isPerp ? ' perp' : ''} failed:`, errorMessage);
    }
  }

  return results;
}

export async function fetchHistoricalData(
  coin: string,
  days: number
): Promise<VolumeData[]> {
  const spotExchanges = createSpotExchanges();
  const futuresExchanges = createFuturesExchanges();
  const fetchedPairs: FetchedPair[] = [];

  // Run all exchanges in parallel for speed
  // Each exchange may have multiple pairs to fetch
  const spotPromises: Promise<VolumeData[]>[] = [];
  for (const [name, exchange] of Object.entries(spotExchanges)) {
    const symbolFn = spotPairs[name];
    if (!symbolFn) continue;
    const symbols = symbolFn(coin);
    for (const symbol of symbols) {
      spotPromises.push(
        fetchExchangeData(exchange, name, symbol, days, false).then((data) => {
          if (data.length > 0) {
            fetchedPairs.push({ exchange: name, symbol, type: 'spot', records: data.length });
          }
          return data;
        })
      );
    }
  }

  const perpPromises: Promise<VolumeData[]>[] = [];
  for (const [name, exchange] of Object.entries(futuresExchanges)) {
    const symbolFn = perpPairs[name];
    if (!symbolFn) continue;
    const symbols = symbolFn(coin);
    for (const symbol of symbols) {
      perpPromises.push(
        fetchExchangeData(exchange, name, symbol, days, true).then((data) => {
          if (data.length > 0) {
            fetchedPairs.push({ exchange: `${name}_perp`, symbol, type: 'perp', records: data.length });
          }
          return data;
        })
      );
    }
  }

  const [spotResults, perpResults] = await Promise.all([
    Promise.all(spotPromises),
    Promise.all(perpPromises),
  ]);

  // Store fetched pairs for API response
  lastFetchedPairs = fetchedPairs;

  const allData = [...spotResults.flat(), ...perpResults.flat()];

  // Filter out today's data for accuracy
  const today = new Date().toISOString().split('T')[0];
  return allData.filter((d) => d.date !== today);
}

export function getLastFetchedPairs(): FetchedPair[] {
  return lastFetchedPairs;
}

export async function getCurrentPrice(coin: string): Promise<number> {
  const exchanges = createSpotExchanges();
  const priorityOrder = ['binance', 'okx', 'bybit', 'kraken', 'coinbase'];

  for (const exchangeName of priorityOrder) {
    const exchange = exchanges[exchangeName];
    if (!exchange) continue;

    try {
      const symbol = exchangeName === 'coinbase' ? `${coin}/USD` : `${coin}/USDT`;
      const ticker = await retryRequest<{ last?: number }>(() =>
        exchange.fetchTicker(symbol)
      );

      if (ticker && typeof ticker.last === 'number' && ticker.last > 0) {
        console.log(`✅ Price from ${exchangeName}: $${ticker.last}`);
        return ticker.last;
      }
    } catch (error) {
      // Silently continue to next exchange
    }
  }

  return 0;
}

export function calculateMarketShare(data: VolumeData[]): VolumeData[] {
  const dailyTotals: Record<string, number> = {};

  for (const item of data) {
    dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.volumeUsd;
  }

  return data.map((item) => ({
    ...item,
    marketSharePct:
      dailyTotals[item.date] > 0
        ? (item.volumeUsd / dailyTotals[item.date]) * 100
        : 0,
  })) as VolumeData[];
}
