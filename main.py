import ccxt
import pandas as pd
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import json


class ExchangeVolumeAnalyzer:
    def __init__(self):
        """Initialize supported exchanges"""
        self.exchanges = {
            'binance': ccxt.binance({'enableRateLimit': True}),
            'coinbase': ccxt.coinbase({'enableRateLimit': True}),
            'upbit': ccxt.upbit({'enableRateLimit': True}),
            'bithumb': ccxt.bithumb({'enableRateLimit': True}),
            'kraken': ccxt.kraken({'enableRateLimit': True}),
            'okx': ccxt.okx({'enableRateLimit': True}),
            'bybit': ccxt.bybit({'enableRateLimit': True}),
            'kucoin': ccxt.kucoin({'enableRateLimit': True})
        }

        # Futures exchanges (support perpetual contracts)
        self.futures_exchanges = {
            'binance': ccxt.binance({'enableRateLimit': True, 'options': {'defaultType': 'future'}}),
            'okx': ccxt.okx({'enableRateLimit': True, 'options': {'defaultType': 'swap'}}),
            'bybit': ccxt.bybit({'enableRateLimit': True, 'options': {'defaultType': 'linear'}}),
            'kucoin': ccxt.kucoin({'enableRateLimit': True, 'options': {'defaultType': 'swap'}})
        }

        # KRW-based exchanges
        self.krw_exchanges = ['upbit', 'bithumb']

    def get_supported_symbols(self, base_coin: str = 'SOL') -> Dict[str, List[str]]:
        """Get supported symbols for each exchange"""
        supported_symbols = {}

        for exchange_name, exchange in self.exchanges.items():
            try:
                markets = exchange.load_markets()
                symbols = []

                # Find all pairs for the base coin
                for symbol in markets:
                    if symbol.startswith(f'{base_coin}/'):
                        symbols.append(symbol)

                if symbols:
                    supported_symbols[exchange_name] = symbols
                    print(f"{exchange_name}: {symbols}")

            except Exception as e:
                print(f"{exchange_name} symbol fetch failed: {str(e)}")

        return supported_symbols

    def fetch_24h_volume_data(self, coin: str = 'SOL') -> Dict[str, Dict]:
        """Fetch 24h volume data including spot and perpetual futures"""
        volume_data = {}
        total_volume_usd = 0

        # Fetch spot volume data
        for exchange_name, exchange in self.exchanges.items():
            try:
                markets = exchange.load_markets()
                exchange_volume = 0
                exchange_data = {}

                # Get all pairs for the coin
                coin_symbols = [s for s in markets if s.startswith(f'{coin}/')]

                for symbol in coin_symbols:
                    try:
                        ticker = exchange.fetch_ticker(symbol)
                        volume_24h = ticker.get('quoteVolume', 0) or ticker.get(
                            'baseVolume', 0) or 0

                        if volume_24h > 0:
                            # Convert to USD (approximate)
                            if symbol.endswith('/USDT') or symbol.endswith('/USDC') or symbol.endswith('/USD'):
                                volume_usd = volume_24h
                            elif symbol.endswith('/KRW'):
                                # Convert KRW to USD (approximate 1 USD = 1300 KRW)
                                volume_usd = volume_24h / 1300
                            else:
                                volume_usd = 0

                            exchange_volume += volume_usd
                            exchange_data[symbol] = {
                                'volume_24h': volume_24h,
                                'volume_usd': volume_usd,
                                'price': ticker.get('last', 0),
                                'timestamp': ticker.get('timestamp', time.time() * 1000),
                                'type': 'spot'
                            }
                    except Exception as e:
                        print(
                            f"{exchange_name} {symbol} spot data fetch failed: {str(e)}")
                        continue

                if exchange_volume > 0:
                    volume_data[exchange_name] = {
                        'total_volume_usd': exchange_volume,
                        'spot_volume_usd': exchange_volume,
                        'perp_volume_usd': 0,
                        'pairs': exchange_data,
                        'timestamp': datetime.now().isoformat()
                    }
                    total_volume_usd += exchange_volume

            except Exception as e:
                print(f"{exchange_name} spot exchange data fetch failed: {str(e)}")

        # Fetch perpetual futures volume data
        for exchange_name, exchange in self.futures_exchanges.items():
            try:
                markets = exchange.load_markets()
                perp_volume = 0
                perp_data = {}

                # Get perpetual symbols for the coin
                perp_symbols = []
                for symbol in markets:
                    # Look for perpetual contracts (usually ends with :USDT or /USDT:USDT)
                    if (f'{coin}/USDT' in symbol or f'{coin}:USDT' in symbol) and 'PERP' not in symbol:
                        perp_symbols.append(symbol)

                for symbol in perp_symbols:
                    try:
                        ticker = exchange.fetch_ticker(symbol)
                        volume_24h = ticker.get('quoteVolume', 0) or ticker.get(
                            'baseVolume', 0) or 0

                        if volume_24h > 0:
                            perp_volume += volume_24h
                            perp_data[symbol] = {
                                'volume_24h': volume_24h,
                                'volume_usd': volume_24h,
                                'price': ticker.get('last', 0),
                                'timestamp': ticker.get('timestamp', time.time() * 1000),
                                'type': 'perp'
                            }
                    except Exception as e:
                        print(
                            f"{exchange_name} {symbol} perp data fetch failed: {str(e)}")
                        continue

                if perp_volume > 0:
                    if exchange_name in volume_data:
                        # Add perp volume to existing exchange data
                        volume_data[exchange_name]['perp_volume_usd'] = perp_volume
                        volume_data[exchange_name]['total_volume_usd'] += perp_volume
                        volume_data[exchange_name]['pairs'].update(perp_data)
                    else:
                        # Create new entry for futures-only exchange
                        volume_data[exchange_name] = {
                            'total_volume_usd': perp_volume,
                            'spot_volume_usd': 0,
                            'perp_volume_usd': perp_volume,
                            'pairs': perp_data,
                            'timestamp': datetime.now().isoformat()
                        }
                    total_volume_usd += perp_volume

            except Exception as e:
                print(f"{exchange_name} perp exchange data fetch failed: {str(e)}")

        # Calculate market share
        for exchange_name in volume_data:
            volume_data[exchange_name]['market_share_pct'] = (
                volume_data[exchange_name]['total_volume_usd'] /
                total_volume_usd * 100
                if total_volume_usd > 0 else 0
            )

        return volume_data, total_volume_usd

    def fetch_historical_data(self, coin: str = 'SOL', days: int = 14) -> pd.DataFrame:
        """Fetch historical OHLCV data for the past N days including spot and perp"""
        historical_data = []

        # Spot trading pairs
        spot_pairs = {
            'binance': f'{coin}/USDT',
            'coinbase': f'{coin}/USD',
            'upbit': f'{coin}/KRW',
            'bithumb': f'{coin}/KRW',
            'okx': f'{coin}/USDT',
            'kraken': f'{coin}/USDT',
            'bybit': f'{coin}/USDT',
            'kucoin': f'{coin}/USDT'
        }

        # Perpetual futures pairs
        perp_pairs = {
            'binance': f'{coin}/USDT',
            'okx': f'{coin}/USDT',
            'bybit': f'{coin}/USDT',
            'kucoin': f'{coin}/USDT'
        }

        # Fetch spot historical data
        for exchange_name, symbol in spot_pairs.items():
            if exchange_name not in self.exchanges:
                continue

            exchange = self.exchanges[exchange_name]

            try:
                markets = exchange.load_markets()
                if symbol not in markets:
                    print(f"{exchange_name} does not support {symbol} (spot)")
                    continue

                # Fetch daily OHLCV data
                ohlcv_data = exchange.fetch_ohlcv(symbol, '1d', limit=days)

                for ohlcv in ohlcv_data:
                    timestamp, open_price, high, low, close, volume = ohlcv
                    date = datetime.fromtimestamp(timestamp / 1000).date()

                    # USD 환산 거래량
                    if symbol.endswith('/KRW'):
                        volume_usd = volume * close / 1350  # KRW to USD
                    else:
                        volume_usd = volume * close  # Quote volume in USD

                    historical_data.append({
                        'date': date,
                        'exchange': exchange_name,
                        'symbol': symbol,
                        'volume_base': volume,
                        'volume_usd': volume_usd,
                        'open': open_price,
                        'high': high,
                        'low': low,
                        'close': close,
                        'type': 'spot'
                    })

            except Exception as e:
                print(
                    f"{exchange_name} {symbol} spot historical data fetch failed: {str(e)}")

        # Fetch perpetual futures historical data
        for exchange_name, symbol in perp_pairs.items():
            if exchange_name not in self.futures_exchanges:
                continue

            exchange = self.futures_exchanges[exchange_name]

            try:
                markets = exchange.load_markets()
                # Find the correct perp symbol format for each exchange
                perp_symbol = None
                for market_symbol in markets:
                    if f'{coin}/USDT' in market_symbol or f'{coin}:USDT' in market_symbol:
                        perp_symbol = market_symbol
                        break

                if not perp_symbol:
                    print(f"{exchange_name} does not support {coin} perpetual")
                    continue

                # Fetch daily OHLCV data
                ohlcv_data = exchange.fetch_ohlcv(
                    perp_symbol, '1d', limit=days)

                for ohlcv in ohlcv_data:
                    timestamp, open_price, high, low, close, volume = ohlcv
                    date = datetime.fromtimestamp(timestamp / 1000).date()

                    # Perp volume is already in USD
                    volume_usd = volume * close

                    historical_data.append({
                        'date': date,
                        'exchange': f"{exchange_name}_perp",
                        'symbol': perp_symbol,
                        'volume_base': volume,
                        'volume_usd': volume_usd,
                        'open': open_price,
                        'high': high,
                        'low': low,
                        'close': close,
                        'type': 'perp'
                    })

            except Exception as e:
                print(
                    f"{exchange_name} {symbol} perp historical data fetch failed: {str(e)}")

        df = pd.DataFrame(historical_data)
        return df

    def calculate_daily_market_share(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate daily market share by exchange"""
        if df.empty:
            return df

        # Calculate total daily volume
        daily_totals = df.groupby('date')['volume_usd'].sum().reset_index()
        daily_totals.rename(
            columns={'volume_usd': 'total_daily_volume'}, inplace=True)

        # Calculate daily market share per exchange
        df = df.merge(daily_totals, on='date')
        df['market_share_pct'] = (
            df['volume_usd'] / df['total_daily_volume'] * 100)

        return df

    def generate_report(self, coin: str = 'SOL') -> str:
        """Generate comprehensive report"""
        print(f"\n=== {coin} Exchange Volume Analysis Report ===\n")

        current_data, total_volume = self.fetch_24h_volume_data(coin)

        if current_data:
            sorted_exchanges = sorted(
                current_data.items(),
                key=lambda x: x[1]['total_volume_usd'],
                reverse=True
            )

            for i, (exchange, data) in enumerate(sorted_exchanges, 1):
                spot_vol = data.get('spot_volume_usd', 0)
                perp_vol = data.get('perp_volume_usd', 0)

                if perp_vol > 0:
                    print(f"{i}. {exchange.upper()}: "
                          f"${data['total_volume_usd']:,.0f} "
                          f"({data['market_share_pct']:.1f}%) "
                          f"[Spot: ${spot_vol:,.0f}, Perp: ${perp_vol:,.0f}]")
                else:
                    print(f"{i}. {exchange.upper()}: "
                          f"${data['total_volume_usd']:,.0f} "
                          f"({data['market_share_pct']:.1f}%) "
                          f"[Spot only]")

            print(f"\nTotal Volume: ${total_volume:,.0f}")

            # Calculate spot vs perp breakdown
            total_spot = sum(data.get('spot_volume_usd', 0)
                             for data in current_data.values())
            total_perp = sum(data.get('perp_volume_usd', 0)
                             for data in current_data.values())

            if total_volume > 0:
                print(
                    f"Spot Volume: ${total_spot:,.0f} ({total_spot/total_volume*100:.1f}%)")
                print(
                    f"Perp Volume: ${total_perp:,.0f} ({total_perp/total_volume*100:.1f}%)")

        print(f"\n📈 Market Share Trend for the Last 14 Days")
        historical_df = self.fetch_historical_data(coin, 14)

        if not historical_df.empty:
            share_df = self.calculate_daily_market_share(historical_df)

            # 7-day average market share
            recent_week = share_df[share_df['date'] >=
                                   (datetime.now().date() - timedelta(days=7))]

            if not recent_week.empty:
                avg_shares = recent_week.groupby(
                    'exchange')['market_share_pct'].mean()
                print("\n7-Day Average Market Share:")
                for exchange in avg_shares.sort_values(ascending=False).index:
                    print(f"- {exchange.upper()}: {avg_shares[exchange]:.1f}%")

        # 3. Detailed Analysis
        report = f"""
🔍 Detailed Analysis Result

Coin: {coin}
Analysis Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Number of Exchanges: {len(current_data)}

Key Findings:
1. Top Exchange by Volume: {max(current_data.items(), key=lambda x: x[1]['total_volume_usd'])[0].upper() if current_data else 'N/A'}
2. KRW Exchange Share: {sum(data['market_share_pct'] for name, data in current_data.items() if name in self.krw_exchanges):.1f}%
3. Non-KRW Exchange Share: {sum(data['market_share_pct'] for name, data in current_data.items() if name not in self.krw_exchanges):.1f}%
        """

        print(report)
        return report


def main():
    """Main execution function"""
    analyzer = ExchangeVolumeAnalyzer()

    # Example usage
    print("🚀 CCXT Exchange Volume Analysis System Started")

    # 1. Check supported symbols
    supported = analyzer.get_supported_symbols('PENGU')

    if not supported:
        print("⚠️ No supported exchanges found.")
        return

    # 2. Generate comprehensive report
    print("\n2️⃣ Generating comprehensive analysis report...")
    report = analyzer.generate_report('PENGU')

    # 3. Print 14-day historical volume table
    print("\n14-Day Historical Exchange Volume Table (Spot + Perp):")
    historical_df = analyzer.fetch_historical_data('PENGU', 14)
    if not historical_df.empty:
        # Group by date and exchange (combining spot and perp for same exchange)
        historical_df['exchange_base'] = historical_df['exchange'].str.replace(
            '_perp', '')
        daily_volume = historical_df.groupby(['date', 'exchange_base'])[
            'volume_usd'].sum().reset_index()
        pivot_table = daily_volume.pivot(
            index='date', columns='exchange_base', values='volume_usd').fillna(0).round(2)
        print(pivot_table)

        # Show spot vs perp breakdown
        print("\nSpot vs Perp Volume Breakdown:")
        type_breakdown = historical_df.groupby('type')['volume_usd'].sum()
        for vol_type, volume in type_breakdown.items():
            print(f"{vol_type.upper()}: ${volume:,.0f}")
    else:
        print("No historical data available.")

    # 4. Historical data summary
    if not historical_df.empty:
        print(f"\nHistorical data summary:")
        print(
            f"Date range: {historical_df['date'].min()} to {historical_df['date'].max()}")
        print(f"Total records: {len(historical_df)}")
        print(f"Exchanges: {', '.join(historical_df['exchange'].unique())}")
    else:
        print("No historical data available.")


if __name__ == "__main__":
    main()
