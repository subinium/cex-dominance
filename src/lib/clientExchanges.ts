// Client-side exchange data fetching for geo-blocked exchanges
// Browser requests don't have geo-restrictions that serverless functions have

export interface ClientVolumeData {
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
}

interface BinanceKline {
  0: number;  // Open time
  1: string;  // Open
  2: string;  // High
  3: string;  // Low
  4: string;  // Close
  5: string;  // Volume
  6: number;  // Close time
  7: string;  // Quote asset volume
}

interface BybitKline {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

// Fetch OHLCV from Binance REST API
async function fetchBinanceOHLCV(
  symbol: string,
  days: number,
  isPerp = false
): Promise<ClientVolumeData[]> {
  const results: ClientVolumeData[] = [];
  const baseUrl = isPerp
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines';

  // Convert symbol format: BTC/USDT -> BTCUSDT
  const binanceSymbol = symbol.replace('/', '');

  try {
    const response = await fetch(
      `${baseUrl}?symbol=${binanceSymbol}&interval=1d&limit=${days + 1}`
    );

    if (!response.ok) {
      console.warn(`Binance ${isPerp ? 'perp' : 'spot'} ${symbol}: ${response.status}`);
      return results;
    }

    const data: BinanceKline[] = await response.json();

    for (const kline of data) {
      const timestamp = kline[0];
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);

      const date = new Date(timestamp);
      const dateStr = date.toISOString().split('T')[0];

      results.push({
        date: dateStr,
        exchange: isPerp ? 'binance_perp' : 'binance',
        symbol,
        volumeBase: volume,
        volumeUsd: volume * close,
        open,
        high,
        low,
        close,
        type: isPerp ? 'perp' : 'spot',
      });
    }

    console.log(`✅ [Client] binance${isPerp ? ' perp' : ''} ${symbol}: ${results.length} records`);
  } catch (error) {
    console.error(`❌ [Client] Binance ${symbol} failed:`, error);
  }

  return results;
}

// Fetch OHLCV from Bybit REST API
async function fetchBybitOHLCV(
  symbol: string,
  days: number,
  isPerp = false
): Promise<ClientVolumeData[]> {
  const results: ClientVolumeData[] = [];
  const category = isPerp ? 'linear' : 'spot';

  // Convert symbol format: BTC/USDT -> BTCUSDT
  const bybitSymbol = symbol.replace('/', '');

  try {
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    const response = await fetch(
      `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${bybitSymbol}&interval=D&start=${startTime}&end=${endTime}&limit=${days + 1}`
    );

    if (!response.ok) {
      console.warn(`Bybit ${isPerp ? 'perp' : 'spot'} ${symbol}: ${response.status}`);
      return results;
    }

    const json = await response.json();

    if (json.retCode !== 0 || !json.result?.list) {
      return results;
    }

    const data: string[][] = json.result.list;

    for (const kline of data) {
      const timestamp = parseInt(kline[0]);
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);

      const date = new Date(timestamp);
      const dateStr = date.toISOString().split('T')[0];

      results.push({
        date: dateStr,
        exchange: isPerp ? 'bybit_perp' : 'bybit',
        symbol,
        volumeBase: volume,
        volumeUsd: volume * close,
        open,
        high,
        low,
        close,
        type: isPerp ? 'perp' : 'spot',
      });
    }

    console.log(`✅ [Client] bybit${isPerp ? ' perp' : ''} ${symbol}: ${results.length} records`);
  } catch (error) {
    console.error(`❌ [Client] Bybit ${symbol} failed:`, error);
  }

  return results;
}

// Main function to fetch missing exchange data from client-side
export async function fetchMissingExchangeData(
  coin: string,
  days: number,
  existingExchanges: Set<string>
): Promise<ClientVolumeData[]> {
  const allData: ClientVolumeData[] = [];
  const promises: Promise<ClientVolumeData[]>[] = [];

  // Check if Binance data is missing
  if (!existingExchanges.has('binance')) {
    // Spot markets
    promises.push(fetchBinanceOHLCV(`${coin}/USDT`, days, false));
    promises.push(fetchBinanceOHLCV(`${coin}/USDC`, days, false));
    promises.push(fetchBinanceOHLCV(`${coin}/FDUSD`, days, false));
  }

  if (!existingExchanges.has('binance_perp')) {
    // Perp markets
    promises.push(fetchBinanceOHLCV(`${coin}/USDT`, days, true));
    promises.push(fetchBinanceOHLCV(`${coin}/USDC`, days, true));
  }

  // Check if Bybit data is missing
  if (!existingExchanges.has('bybit')) {
    promises.push(fetchBybitOHLCV(`${coin}/USDT`, days, false));
    promises.push(fetchBybitOHLCV(`${coin}/USDC`, days, false));
  }

  if (!existingExchanges.has('bybit_perp')) {
    promises.push(fetchBybitOHLCV(`${coin}/USDT`, days, true));
  }

  const results = await Promise.all(promises);

  for (const data of results) {
    allData.push(...data);
  }

  // Filter out today's data
  const today = new Date().toISOString().split('T')[0];
  return allData.filter((d) => d.date !== today);
}
