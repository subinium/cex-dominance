import { NextResponse } from 'next/server';
import { fetchHistoricalData, calculateMarketShare } from '@/lib/exchangeService';
import { KRW_EXCHANGES } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface RefData {
  date: string;
  btcPrice: number;
  ethPrice: number;
  btcKrDom: number;
  ethKrDom: number;
}

export async function GET() {
  try {
    console.log('🔍 Fetching BTC/ETH 90-day reference data...');

    const [btcData, ethData] = await Promise.all([
      fetchHistoricalData('BTC', 90),
      fetchHistoricalData('ETH', 90),
    ]);

    // Filter spot-only first, then calculate market share (same as main chart)
    const btcSpotData = btcData.filter(d => d.type === 'spot');
    const ethSpotData = ethData.filter(d => d.type === 'spot');

    const btcWithShares = calculateMarketShare(btcSpotData);
    const ethWithShares = calculateMarketShare(ethSpotData);

    // Process BTC data
    const btcByDate: Record<string, { price: number; krDom: number }> = {};
    for (const item of btcWithShares) {
      const baseEx = item.exchange.replace('_perp', '');
      if (!btcByDate[item.date]) {
        btcByDate[item.date] = { price: item.close, krDom: 0 };
      }
      if (KRW_EXCHANGES.includes(baseEx)) {
        btcByDate[item.date].krDom += item.marketSharePct || 0;
      }
    }

    // Process ETH data
    const ethByDate: Record<string, { price: number; krDom: number }> = {};
    for (const item of ethWithShares) {
      const baseEx = item.exchange.replace('_perp', '');
      if (!ethByDate[item.date]) {
        ethByDate[item.date] = { price: item.close, krDom: 0 };
      }
      if (KRW_EXCHANGES.includes(baseEx)) {
        ethByDate[item.date].krDom += item.marketSharePct || 0;
      }
    }

    // Merge data
    const allDates = [...new Set([...Object.keys(btcByDate), ...Object.keys(ethByDate)])].sort();
    const refData: RefData[] = allDates.map(date => ({
      date,
      btcPrice: btcByDate[date]?.price || 0,
      ethPrice: ethByDate[date]?.price || 0,
      btcKrDom: btcByDate[date]?.krDom || 0,
      ethKrDom: ethByDate[date]?.krDom || 0,
    })).filter(d => d.btcPrice > 0 || d.ethPrice > 0);

    // Current KR dominance
    const latestBtcKrDom = refData.length > 0 ? refData[refData.length - 1].btcKrDom : 0;
    const latestEthKrDom = refData.length > 0 ? refData[refData.length - 1].ethKrDom : 0;

    return NextResponse.json({
      success: true,
      data: refData,
      btcKrDominance: latestBtcKrDom,
      ethKrDominance: latestEthKrDom,
    });
  } catch (error) {
    console.error('Reference API Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
