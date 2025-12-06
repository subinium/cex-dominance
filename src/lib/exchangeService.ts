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

const spotPairs: Record<string, (coin: string) => string> = {
  binance: (coin) => `${coin}/USDT`,
  coinbase: (coin) => `${coin}/USD`,
  upbit: (coin) => `${coin}/KRW`,
  bithumb: (coin) => `${coin}/KRW`,
  okx: (coin) => `${coin}/USDT`,
  kraken: (coin) => `${coin}/USDT`,
  bybit: (coin) => `${coin}/USDT`,
  kucoin: (coin) => `${coin}/USDT`,
};

const perpPairs: Record<string, (coin: string) => string> = {
  binance: (coin) => `${coin}/USDT`,
  okx: (coin) => `${coin}/USDT`,
  bybit: (coin) => `${coin}/USDT`,
  kucoin: (coin) => `${coin}/USDT`,
};

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

  // Run all exchanges in parallel for speed
  const spotPromises = Object.entries(spotExchanges).map(([name, exchange]) => {
    const symbolFn = spotPairs[name];
    if (!symbolFn) return Promise.resolve([]);
    return fetchExchangeData(exchange, name, symbolFn(coin), days, false);
  });

  const perpPromises = Object.entries(futuresExchanges).map(([name, exchange]) => {
    const symbolFn = perpPairs[name];
    if (!symbolFn) return Promise.resolve([]);
    // For perps, try different symbol formats
    const baseSymbol = symbolFn(coin);
    return fetchExchangeData(exchange, name, baseSymbol, days, true);
  });

  const [spotResults, perpResults] = await Promise.all([
    Promise.all(spotPromises),
    Promise.all(perpPromises),
  ]);

  const allData = [...spotResults.flat(), ...perpResults.flat()];

  // Filter out today's data for accuracy
  const today = new Date().toISOString().split('T')[0];
  return allData.filter((d) => d.date !== today);
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
