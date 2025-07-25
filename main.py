import ccxt
import pandas as pd
import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import random
import os


class ExchangeVolumeAnalyzer:
    def __init__(self):
        """Initialize supported exchanges with optimized settings"""

        # Check if running on Streamlit Cloud
        self.is_streamlit_cloud = os.environ.get(
            'STREAMLIT_SERVER_PORT') is not None

        # Error tracking for UI display
        self.api_errors = {}
        self.connection_status = {}

        # Enhanced headers for all environments
        self.enhanced_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'DNT': '1',
            'Upgrade-Insecure-Requests': '1'
        }

        # Streamlit Cloud specific settings
        if self.is_streamlit_cloud:
            print("🔧 Detected Streamlit Cloud environment - applying optimized settings")
            # More conservative settings for Streamlit Cloud
            common_config = {
                'enableRateLimit': True,
                'timeout': 45000,  # 45 seconds (under Streamlit's 60s limit)
                'rateLimit': 500,  # 500ms between requests (more conservative)
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                }
            }

            # Even more conservative for problematic exchanges
            binance_config = {
                'enableRateLimit': True,
                'timeout': 45000,  # 45 seconds
                'rateLimit': 1000,  # 1 second between requests
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                    'recvWindow': 60000,
                    'warnOnFetchOHLCVLimitArgument': False,
                }
            }

            bybit_config = {
                'enableRateLimit': True,
                'timeout': 45000,  # 45 seconds
                'rateLimit': 1000,  # 1 second between requests
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                }
            }
        else:
            # Local development settings
            common_config = {
                'enableRateLimit': True,
                'timeout': 20000,  # 20 seconds timeout
                'rateLimit': 150,  # 150ms between requests
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                }
            }

            binance_config = {
                'enableRateLimit': True,
                'timeout': 30000,  # 30 seconds timeout
                'rateLimit': 300,  # 300ms between requests
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                    'recvWindow': 60000,
                    'warnOnFetchOHLCVLimitArgument': False,
                }
            }

            bybit_config = {
                'enableRateLimit': True,
                'timeout': 30000,  # 30 seconds timeout
                'rateLimit': 300,  # 300ms between requests
                'options': {
                    'defaultType': 'spot',
                    'adjustForTimeDifference': True,
                }
            }

        # Initialize exchanges with appropriate configs
        self.exchanges = {
            'binance': ccxt.binance(binance_config),
            'coinbase': ccxt.coinbase({**common_config, 'options': {**common_config['options'], 'sandbox': False}}),
            'upbit': ccxt.upbit({**common_config}),
            'bithumb': ccxt.bithumb({**common_config}),
            'kraken': ccxt.kraken({**common_config}),
            'okx': ccxt.okx({**common_config}),
            'bybit': ccxt.bybit(bybit_config),
            'kucoin': ccxt.kucoin({**common_config})
        }

        # Add enhanced headers to all exchanges
        for exchange_name, exchange in self.exchanges.items():
            exchange.headers = self.enhanced_headers.copy()

            # Add exchange-specific headers
            if exchange_name == 'binance':
                exchange.headers.update({
                    'Origin': 'https://www.binance.com',
                    'Referer': 'https://www.binance.com/',
                })
            elif exchange_name == 'bybit':
                exchange.headers.update({
                    'Origin': 'https://www.bybit.com',
                    'Referer': 'https://www.bybit.com/',
                })
            elif exchange_name == 'kraken':
                exchange.headers.update({
                    'Origin': 'https://www.kraken.com',
                    'Referer': 'https://www.kraken.com/',
                })
            elif exchange_name == 'coinbase':
                exchange.headers.update({
                    'Origin': 'https://pro.coinbase.com',
                    'Referer': 'https://pro.coinbase.com/',
                })
            elif exchange_name == 'okx':
                exchange.headers.update({
                    'Origin': 'https://www.okx.com',
                    'Referer': 'https://www.okx.com/',
                })
            elif exchange_name == 'kucoin':
                exchange.headers.update({
                    'Origin': 'https://www.kucoin.com',
                    'Referer': 'https://www.kucoin.com/',
                })

        # Futures exchanges (support perpetual contracts)
        futures_config = {**common_config,
                          'options': {**common_config['options']}}
        self.futures_exchanges = {
            'binance': ccxt.binance({**futures_config, 'options': {**futures_config['options'], 'defaultType': 'future', 'recvWindow': 60000}}),
            'okx': ccxt.okx({**futures_config, 'options': {**futures_config['options'], 'defaultType': 'swap'}}),
            'bybit': ccxt.bybit({**futures_config, 'options': {**futures_config['options'], 'defaultType': 'linear'}}),
            'kucoin': ccxt.kucoin({**futures_config, 'options': {**futures_config['options'], 'defaultType': 'swap'}})
        }

        # Add enhanced headers to futures exchanges too
        for exchange_name, exchange in self.futures_exchanges.items():
            exchange.headers = self.enhanced_headers.copy()

            # Add exchange-specific headers for futures
            if exchange_name == 'binance':
                exchange.headers.update({
                    'Origin': 'https://www.binance.com',
                    'Referer': 'https://www.binance.com/',
                })
            elif exchange_name == 'bybit':
                exchange.headers.update({
                    'Origin': 'https://www.bybit.com',
                    'Referer': 'https://www.bybit.com/',
                })
            elif exchange_name == 'okx':
                exchange.headers.update({
                    'Origin': 'https://www.okx.com',
                    'Referer': 'https://www.okx.com/',
                })
            elif exchange_name == 'kucoin':
                exchange.headers.update({
                    'Origin': 'https://www.kucoin.com',
                    'Referer': 'https://www.kucoin.com/',
                })

        # KRW-based exchanges
        self.krw_exchanges = ['upbit', 'bithumb']

        # Exchange priority (more reliable ones first)
        self.exchange_priority = [
            'kraken', 'coinbase', 'okx', 'kucoin', 'upbit', 'bithumb', 'binance', 'bybit']

    def _retry_request(self, func, max_retries=3, base_delay=1):
        """Retry function with exponential backoff"""
        for attempt in range(max_retries):
            try:
                return func()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e

                # Streamlit Cloud: longer delays
                if self.is_streamlit_cloud:
                    delay = base_delay * (3 ** attempt) + random.uniform(1, 3)
                else:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)

                print(
                    f"Attempt {attempt + 1} failed, retrying in {delay:.2f}s...")
                time.sleep(delay)

    def _safe_fetch_ticker(self, exchange, symbol, exchange_name):
        """Safely fetch ticker with retry mechanism"""
        def fetch():
            return exchange.fetch_ticker(symbol)

        try:
            result = self._retry_request(fetch, max_retries=3, base_delay=2)
            if result:
                self._track_success(exchange_name, f"fetch_ticker({symbol})")
            return result
        except Exception as e:
            print(f"❌ {exchange_name} ticker fetch failed after retries: {str(e)}")
            self._track_error(exchange_name, f"fetch_ticker({symbol})", e)
            return None

    def _safe_fetch_ohlcv(self, exchange, symbol, timeframe, limit, exchange_name):
        """Safely fetch OHLCV with retry mechanism"""
        def fetch():
            return exchange.fetch_ohlcv(symbol, timeframe, limit=limit)

        try:
            result = self._retry_request(fetch, max_retries=3, base_delay=2)
            if result:
                self._track_success(
                    exchange_name, f"fetch_ohlcv({symbol}, {timeframe})")
            return result
        except Exception as e:
            print(f"❌ {exchange_name} OHLCV fetch failed after retries: {str(e)}")
            self._track_error(
                exchange_name, f"fetch_ohlcv({symbol}, {timeframe})", e)
            return None

    def _safe_load_markets(self, exchange, exchange_name):
        """Safely load markets with retry mechanism"""
        def load():
            return exchange.load_markets()

        try:
            result = self._retry_request(load, max_retries=3, base_delay=1)
            if result:
                self._track_success(exchange_name, "load_markets")
            return result
        except Exception as e:
            print(f"❌ {exchange_name} markets load failed after retries: {str(e)}")
            self._track_error(exchange_name, "load_markets", e)
            return None

    def _track_error(self, exchange_name: str, operation: str, error: Exception):
        """Track detailed error information for UI display"""
        error_info = {
            'exchange': exchange_name,
            'operation': operation,
            'error_type': type(error).__name__,
            'error_message': str(error),
            'timestamp': datetime.now().isoformat(),
            'is_streamlit_cloud': self.is_streamlit_cloud
        }

        # Add more specific error details
        if hasattr(error, 'response'):
            error_info['status_code'] = getattr(
                error.response, 'status_code', None)
            error_info['response_text'] = getattr(error.response, 'text', None)

        if hasattr(error, 'args') and error.args:
            error_info['error_args'] = str(error.args)

        # Store error by exchange
        if exchange_name not in self.api_errors:
            self.api_errors[exchange_name] = []
        self.api_errors[exchange_name].append(error_info)

        # Update connection status
        self.connection_status[exchange_name] = {
            'status': 'failed',
            'last_error': error_info,
            'last_attempt': datetime.now().isoformat()
        }

    def _track_success(self, exchange_name: str, operation: str):
        """Track successful operations"""
        self.connection_status[exchange_name] = {
            'status': 'success',
            'last_operation': operation,
            'last_attempt': datetime.now().isoformat()
        }

    def get_api_errors_summary(self) -> dict:
        """Get summary of API errors for UI display"""
        summary = {
            'total_exchanges': len(self.exchanges),
            'successful_exchanges': 0,
            'failed_exchanges': 0,
            'error_details': {},
            'connection_status': self.connection_status.copy()
        }

        for exchange_name in self.exchanges.keys():
            if exchange_name in self.api_errors:
                summary['failed_exchanges'] += 1
                summary['error_details'][exchange_name] = {
                    'error_count': len(self.api_errors[exchange_name]),
                    'last_error': self.api_errors[exchange_name][-1] if self.api_errors[exchange_name] else None,
                    'all_errors': self.api_errors[exchange_name]
                }
            else:
                summary['successful_exchanges'] += 1

        return summary

    def get_missing_exchanges_with_reasons(self) -> dict:
        """Get detailed information about missing exchanges and why they failed"""
        missing_info = {}

        for exchange_name in self.exchanges.keys():
            if exchange_name in self.api_errors:
                errors = self.api_errors[exchange_name]
                if errors:
                    last_error = errors[-1]
                    missing_info[exchange_name] = {
                        'reason': last_error['error_message'],
                        'error_type': last_error['error_type'],
                        'status_code': last_error.get('status_code'),
                        'operation': last_error['operation'],
                        'timestamp': last_error['timestamp']
                    }

        return missing_info

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
        print(f"🔍 Fetching 24h volume data for {coin}...")
        volume_data = {}
        total_volume_usd = 0

        # Fetch spot volume data - use priority order for Streamlit Cloud
        for exchange_name in self.exchange_priority:
            if exchange_name not in self.exchanges:
                continue

            exchange = self.exchanges[exchange_name]
            try:
                print(f"🔍 Processing {exchange_name}...")

                # Load markets safely
                markets = self._safe_load_markets(exchange, exchange_name)
                if not markets:
                    print(
                        f"⚠️ {exchange_name} markets not available, skipping...")
                    continue

                exchange_volume = 0
                exchange_data = {}

                # Get all pairs for the coin
                coin_symbols = [s for s in markets if s.startswith(f'{coin}/')]

                if not coin_symbols:
                    print(f"⚠️ {exchange_name} does not support {coin} pairs")
                    continue

                for symbol in coin_symbols:
                    try:
                        ticker = self._safe_fetch_ticker(
                            exchange, symbol, exchange_name)
                        if not ticker:
                            continue

                        volume_24h = ticker.get('quoteVolume', 0) or ticker.get(
                            'baseVolume', 0) or 0

                        if volume_24h > 0:
                            # Convert to USD (fixed rate)
                            if symbol.endswith('/USDT') or symbol.endswith('/USDC') or symbol.endswith('/USD'):
                                volume_usd = volume_24h
                            elif symbol.endswith('/KRW'):
                                # Convert KRW to USD (fixed rate 1350)
                                volume_usd = volume_24h / 1350
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
                            f"⚠️ {exchange_name} {symbol} spot data fetch failed: {str(e)}")

                if exchange_volume > 0:
                    volume_data[exchange_name] = {
                        'spot_volume_usd': exchange_volume,
                        'perp_volume_usd': 0,
                        'total_volume_usd': exchange_volume,
                        'spot_data': exchange_data
                    }
                    total_volume_usd += exchange_volume
                    print(
                        f"✅ {exchange_name} spot volume: ${exchange_volume:,.0f}")

            except Exception as e:
                print(f"❌ {exchange_name} spot volume fetch failed: {str(e)}")
                continue

        # Fetch perpetual futures volume data
        for exchange_name, exchange in self.futures_exchanges.items():
            try:
                print(f"🔍 Processing {exchange_name} perpetual...")

                markets = self._safe_load_markets(exchange, exchange_name)
                if not markets:
                    print(
                        f"⚠️ {exchange_name} perpetual markets not available, skipping...")
                    continue

                perp_volume = 0
                perp_data = {}

                # Get all perp pairs for the coin
                perp_symbols = []
                for symbol in markets:
                    if f'{coin}/USDT' in symbol or f'{coin}:USDT' in symbol:
                        perp_symbols.append(symbol)

                if not perp_symbols:
                    print(
                        f"⚠️ {exchange_name} does not support {coin} perpetual pairs")
                    continue

                for symbol in perp_symbols:
                    try:
                        ticker = self._safe_fetch_ticker(
                            exchange, symbol, exchange_name)
                        if not ticker:
                            continue

                        volume_24h = ticker.get('quoteVolume', 0) or ticker.get(
                            'baseVolume', 0) or 0

                        if volume_24h > 0:
                            # Perp volume is already in USD
                            volume_usd = volume_24h

                            perp_volume += volume_usd
                            perp_data[symbol] = {
                                'volume_24h': volume_24h,
                                'volume_usd': volume_usd,
                                'price': ticker.get('last', 0),
                                'timestamp': ticker.get('timestamp', time.time() * 1000),
                                'type': 'perp'
                            }
                    except Exception as e:
                        print(
                            f"⚠️ {exchange_name} {symbol} perp data fetch failed: {str(e)}")

                if perp_volume > 0:
                    # Add to existing exchange data or create new entry
                    if exchange_name in volume_data:
                        volume_data[exchange_name]['perp_volume_usd'] = perp_volume
                        volume_data[exchange_name]['total_volume_usd'] += perp_volume
                        volume_data[exchange_name]['perp_data'] = perp_data
                    else:
                        volume_data[exchange_name] = {
                            'spot_volume_usd': 0,
                            'perp_volume_usd': perp_volume,
                            'total_volume_usd': perp_volume,
                            'perp_data': perp_data
                        }
                    total_volume_usd += perp_volume
                    print(
                        f"✅ {exchange_name} perpetual volume: ${perp_volume:,.0f}")

            except Exception as e:
                print(f"❌ {exchange_name} perp volume fetch failed: {str(e)}")
                continue

        return volume_data, total_volume_usd

    def fetch_historical_data(self, coin: str = 'SOL', days: int = 14) -> pd.DataFrame:
        """Fetch historical OHLCV data for the past N days including spot and perp (excluding today)"""
        print(
            f"📈 Fetching {days-1} days historical data for {coin} (excluding today)...")
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

        # For Streamlit Cloud, limit days to avoid timeout
        if self.is_streamlit_cloud and days > 14:
            print(
                "🔧 Streamlit Cloud detected - limiting to 14 days for better performance")
            days = 14

        # Perpetual futures pairs
        perp_pairs = {
            'binance': f'{coin}/USDT',
            'okx': f'{coin}/USDT',
            'bybit': f'{coin}/USDT',
            'kucoin': f'{coin}/USDT'
        }

        # Fetch spot historical data - use priority order for Streamlit Cloud
        successful_spot_exchanges = []
        for exchange_name in self.exchange_priority:
            if exchange_name not in spot_pairs:
                continue

            symbol = spot_pairs[exchange_name]
            if exchange_name not in self.exchanges:
                continue

            exchange = self.exchanges[exchange_name]

            try:
                print(f"🔍 Fetching spot data from {exchange_name}...")

                # Load markets safely
                markets = self._safe_load_markets(exchange, exchange_name)
                if not markets:
                    print(
                        f"⚠️ {exchange_name} markets not available, skipping...")
                    continue

                if symbol not in markets:
                    print(
                        f"⚠️ {exchange_name} does not support {symbol} (spot)")
                    continue

                # Fetch daily OHLCV data (excluding today)
                print(f"📊 Fetching OHLCV from {exchange_name} for {symbol}...")
                ohlcv_data = self._safe_fetch_ohlcv(
                    exchange, symbol, '1d', days-1, exchange_name)

                if ohlcv_data and len(ohlcv_data) > 0:
                    for ohlcv in ohlcv_data:
                        timestamp, open_price, high, low, close, volume = ohlcv
                        date = datetime.fromtimestamp(timestamp / 1000).date()

                        if symbol.endswith('/KRW'):
                            volume_usd = volume * close / 1350
                        else:
                            volume_usd = volume * close

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
                    successful_spot_exchanges.append(exchange_name)
                    print(
                        f"✅ {exchange_name} spot data: {len(ohlcv_data)} records")
                else:
                    print(f"⚠️ {exchange_name} returned empty spot data")

            except Exception as e:
                print(f"❌ {exchange_name} spot data fetch failed: {str(e)}")
                continue

        # Fetch perpetual futures historical data
        successful_perp_exchanges = []
        for exchange_name, symbol in perp_pairs.items():
            if exchange_name not in self.futures_exchanges:
                continue

            exchange = self.futures_exchanges[exchange_name]

            try:
                print(f"🔍 Fetching perp data from {exchange_name}...")

                markets = self._safe_load_markets(exchange, exchange_name)
                if not markets:
                    print(
                        f"⚠️ {exchange_name} perpetual markets not available, skipping...")
                    continue

                perp_symbol = None
                for market_symbol in markets:
                    if f'{coin}/USDT' in market_symbol or f'{coin}:USDT' in market_symbol:
                        perp_symbol = market_symbol
                        break

                if not perp_symbol:
                    print(
                        f"⚠️ {exchange_name} does not support {coin} perpetual")
                    continue

                ohlcv_data = self._safe_fetch_ohlcv(
                    exchange, perp_symbol, '1d', days-1, exchange_name)

                if ohlcv_data and len(ohlcv_data) > 0:
                    for ohlcv in ohlcv_data:
                        timestamp, open_price, high, low, close, volume = ohlcv
                        date = datetime.fromtimestamp(timestamp / 1000).date()
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
                    successful_perp_exchanges.append(exchange_name)
                    print(
                        f"✅ {exchange_name} perp data: {len(ohlcv_data)} records")
                else:
                    print(f"⚠️ {exchange_name} returned empty perp data")

            except Exception as e:
                print(f"❌ {exchange_name} perp data fetch failed: {str(e)}")
                continue

        print(
            f"📊 Successfully fetched data from {len(successful_spot_exchanges)} spot exchanges and {len(successful_perp_exchanges)} perp exchanges")

        df = pd.DataFrame(historical_data)
        return df

    def get_current_price(self, coin: str = 'SOL') -> float:
        """Get current price from major exchanges"""
        prices = []

        # Try to get current price from major exchanges
        major_exchanges = ['kraken', 'coinbase', 'okx', 'bybit', 'binance']

        for exchange_name in major_exchanges:
            if exchange_name not in self.exchanges:
                continue

            exchange = self.exchanges[exchange_name]

            try:
                # Try USDT pair first
                symbol = f'{coin}/USDT'
                if exchange_name == 'coinbase':
                    symbol = f'{coin}/USD'

                ticker = self._safe_fetch_ticker(
                    exchange, symbol, exchange_name)
                if not ticker:
                    continue

                current_price = ticker.get('last', 0)

                if current_price > 0:
                    prices.append(current_price)
                    print(
                        f"✅ Current price from {exchange_name}: ${current_price}")

            except Exception as e:
                print(
                    f"⚠️ Failed to get current price from {exchange_name}: {str(e)}")
                continue

        if prices:
            # Return average price
            avg_price = sum(prices) / len(prices)
            print(f"💰 Average current price: ${avg_price}")
            return avg_price
        else:
            print("❌ Could not fetch current price from any exchange")
            return 0.0

    def get_today_data(self, coin: str = 'SOL') -> pd.DataFrame:
        """Get today's data - return empty DataFrame to avoid inflated volume"""
        print(f"📊 Getting today's data for {coin}...")
        print("⚠️ Today's volume data excluded to avoid inflated comparisons")

        # Return empty DataFrame - we'll only use historical data for accurate comparison
        return pd.DataFrame()

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
