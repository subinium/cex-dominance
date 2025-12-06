import { NextRequest, NextResponse } from 'next/server';
import {
  fetchHistoricalData,
  getCurrentPrice,
  calculateMarketShare,
} from '@/lib/exchangeService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker')?.toUpperCase() || 'BTC';
  const days = parseInt(searchParams.get('days') || '14', 10);

  try {
    console.log(`🔍 Fetching data for ${ticker} (${days} days)...`);

    const [historicalData, currentPrice] = await Promise.all([
      fetchHistoricalData(ticker, days),
      getCurrentPrice(ticker),
    ]);

    if (historicalData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No data found for ${ticker}. Please check if the token is listed on major exchanges.`,
        },
        { status: 404 }
      );
    }

    const dataWithShares = calculateMarketShare(historicalData);

    return NextResponse.json({
      success: true,
      data: dataWithShares,
      currentPrice,
      ticker,
      days,
      exchangeCount: [...new Set(historicalData.map((d) => d.exchange))].length,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
