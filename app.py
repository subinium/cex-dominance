from main import ExchangeVolumeAnalyzer
import streamlit as st
import pandas as pd
import plotly.graph_objs as go
from datetime import datetime, timedelta
from plotly.subplots import make_subplots
import time
import os

# Configure for better deployment stability
os.environ['CCXT_ASYNC'] = 'false'  # Disable async for better compatibility
os.environ['CCXT_RETRY'] = 'true'   # Enable retry mechanism

# Environment detection
if os.environ.get('STREAMLIT_SERVER_PORT'):
    st.info(
        "🔧 Running on Streamlit Cloud - using optimized settings for better reliability")
    st.session_state.streamlit_cloud = True
else:
    st.session_state.streamlit_cloud = False


st.set_page_config(page_title="Exchange Dominance Dashboard", layout="wide")
st.title("Exchange Dominance & Price Dashboard")

# Add session state for caching
if 'analyzer' not in st.session_state:
    st.session_state.analyzer = ExchangeVolumeAnalyzer()

# Ticker input with auto-formatting
ticker_input = st.text_input(
    "Enter token ticker (e.g., SOL, PENGU):", value="PENGU")
# Auto-format ticker: uppercase and remove spaces
ticker = ticker_input.strip().upper() if ticker_input else ""
# Period input
days = st.number_input("Select period (days)", min_value=2,
                       max_value=365, value=14, step=1)

if ticker:
    analyzer = st.session_state.analyzer

    # Add progress tracking
    progress_bar = st.progress(0)
    status_text = st.empty()

    try:
        with st.spinner(f"Fetching data for {ticker} ({days} days)..."):
            # Clear previous error tracking
            analyzer.api_errors.clear()
            analyzer.connection_status.clear()

            status_text.text("📈 Fetching historical data...")
            progress_bar.progress(30)

            # Get historical data (excluding today)
            historical_df = analyzer.fetch_historical_data(ticker, int(days))

            status_text.text("📊 Fetching today's data...")
            progress_bar.progress(60)

            # Get today's data separately
            today_df = analyzer.get_today_data(ticker)

            status_text.text("🔄 Processing and combining data...")
            progress_bar.progress(80)

            # Use only historical data for accurate comparison
            combined_df = historical_df
            st.success(
                f"✅ Using {len(historical_df)} historical records for accurate comparison")
            st.info(
                "💡 Today's volume data excluded to avoid inflated comparisons with 24h data")

            progress_bar.progress(100)
            status_text.text("🎉 Data processing complete!")
            time.sleep(0.5)
            progress_bar.empty()
            status_text.empty()

    except Exception as e:
        st.error(f"❌ Error fetching data: {str(e)}")

        if st.session_state.get('streamlit_cloud', False):
            st.warning("🌐 Streamlit Cloud Environment Detected")
            st.info(
                "💡 Streamlit Cloud has network restrictions that may affect API calls.")
            st.info(
                "🔧 The app uses optimized settings and enhanced headers for better reliability.")
            st.info(
                "⏱️ Please wait 30-60 seconds between requests to avoid rate limiting.")
        else:
            st.info(
                "💡 This might be due to network issues or API rate limits. Try refreshing the page in a few moments.")

        st.info("🔧 If the problem persists, try a different token or check if the token is listed on major exchanges.")
        st.stop()

    if not combined_df.empty:
        # Remove duplicates before pivot
        st.info(f"📊 Processing {len(combined_df)} total records")

        # Remove duplicates based on date and exchange (keep the latest record)
        combined_df = combined_df.drop_duplicates(
            subset=['date', 'exchange'], keep='last')

        # Show which exchanges we have data for
        available_exchanges = combined_df['exchange'].unique()
        st.success(f"✅ Data available for: {', '.join(available_exchanges)}")

        # Show API connection summary
        api_summary = analyzer.get_api_errors_summary()
        if api_summary['failed_exchanges'] > 0:
            st.info(
                f"📊 API Connection Summary: {api_summary['successful_exchanges']} successful, {api_summary['failed_exchanges']} failed out of {api_summary['total_exchanges']} exchanges")

        # Show missing exchanges with detailed error information
        expected_exchanges = ['binance', 'bybit', 'okx',
                              'kucoin', 'coinbase', 'kraken', 'upbit', 'bithumb']
        missing_exchanges = [
            ex for ex in expected_exchanges if ex not in available_exchanges]
        if missing_exchanges:
            st.warning(f"⚠️ Missing data for: {', '.join(missing_exchanges)}")

            # Get detailed error information
            missing_info = analyzer.get_missing_exchanges_with_reasons()

            if missing_info:
                st.subheader("🔍 API Connection Issues Details")

                for exchange_name, error_info in missing_info.items():
                    if exchange_name in missing_exchanges:
                        with st.expander(f"❌ {exchange_name.upper()} - {error_info['error_type']}"):
                            st.write(
                                f"**Error Type:** {error_info['error_type']}")
                            st.write(
                                f"**Operation:** {error_info['operation']}")
                            st.write(f"**Reason:** {error_info['reason']}")
                            if error_info.get('status_code'):
                                st.write(
                                    f"**HTTP Status:** {error_info['status_code']}")
                            st.write(f"**Time:** {error_info['timestamp']}")

                            # Provide specific suggestions based on error type
                            if 'timeout' in error_info['reason'].lower():
                                st.info(
                                    "💡 **Suggestion:** This appears to be a timeout issue. Try refreshing the page or wait a few minutes.")
                            elif 'rate limit' in error_info['reason'].lower():
                                st.info(
                                    "💡 **Suggestion:** Rate limit exceeded. Please wait 30-60 seconds before trying again.")
                            elif '403' in str(error_info.get('status_code', '')):
                                st.info(
                                    "💡 **Suggestion:** Access forbidden. This might be due to IP restrictions.")
                            elif '429' in str(error_info.get('status_code', '')):
                                st.info(
                                    "💡 **Suggestion:** Too many requests. Please wait before trying again.")
                            else:
                                st.info(
                                    "💡 **Suggestion:** This might be due to network issues or API changes. Try refreshing the page.")

            st.info(
                "💡 This is normal for some tokens or during high traffic periods. The app will work with available data.")

        # Dominance (market share) calculation
        share_df = analyzer.calculate_daily_market_share(combined_df)
        dominance_pivot = share_df.pivot(
            index='date', columns='exchange', values='market_share_pct').fillna(0)
        volume_pivot = combined_df.pivot(
            index='date', columns='exchange', values='volume_usd').fillna(0)

        # Prepare price_df for close price (binance preferred, else first exchange)
        if 'close' in combined_df.columns:
            if 'binance' in combined_df['exchange'].unique():
                price_df = combined_df[combined_df['exchange'] == 'binance'][[
                    'date', 'close']].drop_duplicates(subset=['date']).set_index('date')
            else:
                price_df = combined_df.groupby(
                    'date')['close'].first().to_frame()
            price_df = price_df.sort_index()
        else:
            price_df = pd.DataFrame(columns=['close'])

        # Add current price for today (with better error handling)
        current_price = 0.0
        try:
            with st.spinner("💰 Fetching current price..."):
                current_price = analyzer.get_current_price(ticker)
            if current_price > 0:
                today = datetime.now().date()
                price_df.loc[today] = current_price
                st.success(f"💰 Current price: ${current_price:,.4f}")
            else:
                st.warning(
                    "⚠️ Could not fetch current price - using latest historical price")
                # Use the latest available price from historical data
                if not price_df.empty:
                    latest_price = price_df['close'].iloc[-1]
                    st.info(f"📊 Latest available price: ${latest_price:,.4f}")
        except Exception as e:
            st.warning(f"⚠️ Error fetching current price: {str(e)}")
            # Use the latest available price from historical data
            if not price_df.empty:
                latest_price = price_df['close'].iloc[-1]
                st.info(f"📊 Latest available price: ${latest_price:,.4f}")

        krw_exchanges = ['upbit', 'bithumb']
        exchange_colors = {
            'binance': '#F3BA2F',
            'coinbase': '#0052FF',
            'upbit': '#1C64F2',
            'bithumb': '#FF5C5C',
            'kraken': '#5546FF',
            'okx': '#8B4513',
            'bybit': '#F9D326',
            'kucoin': '#28C893',
        }

        # KRW vs Non-KRW 거래소 분류
        krw_exchanges = ['upbit', 'bithumb']
        non_krw_exchanges = ['binance', 'bybit',
                             'okx', 'kucoin', 'coinbase', 'kraken']

        # Perp 거래소 리스트 정의 (main.py에서 _perp 접미사 사용)
        major_exchanges = ['binance', 'bybit', 'okx',
                           'kucoin', 'coinbase', 'kraken', 'upbit', 'bithumb']
        perp_exchanges = [f"{ex}_perp" for ex in major_exchanges]

        # Spot Only / Spot+Perp 선택
        volume_mode = st.radio(
            "Volume Mode", ["Spot Only", "Spot+Perp"], index=0)

        # 선택에 따라 컬럼 필터링 및 데이터 처리
        if volume_mode == "Spot Only":
            # Spot Only 모드: perp 거래소 제외하고 spot만 사용
            filtered_columns = dominance_pivot.columns.difference(
                perp_exchanges)

            # KR/Non-KR 그룹화 (spot만)
            krw_cols = [col for col in filtered_columns if any(
                ex in col for ex in krw_exchanges)]
            non_krw_cols = [col for col in filtered_columns if any(
                ex in col for ex in non_krw_exchanges)]

            # Spot Only용 피벗 테이블 생성
            spot_dominance_pivot = dominance_pivot[filtered_columns]
            spot_volume_pivot = volume_pivot[filtered_columns]

            # 각 날짜별로 100%로 정규화
            spot_dominance_pivot = spot_dominance_pivot.div(
                spot_dominance_pivot.sum(axis=1), axis=0) * 100

            grouped_dom = pd.DataFrame({
                'KR': spot_dominance_pivot[krw_cols].sum(axis=1),
                'Non-KR': spot_dominance_pivot[non_krw_cols].sum(axis=1)
            })
            grouped_vol = pd.DataFrame({
                'KR': spot_volume_pivot[krw_cols].sum(axis=1),
                'Non-KR': spot_volume_pivot[non_krw_cols].sum(axis=1)
            })

        else:  # Spot+Perp 모드
            # Spot과 Perp 데이터를 합치기 위해 exchange_base 컬럼 사용
            share_df['exchange_base'] = share_df['exchange'].str.replace(
                '_perp', '')
            volume_df = historical_df.copy()
            volume_df['exchange_base'] = volume_df['exchange'].str.replace(
                '_perp', '')

            # 합친 데이터로 새로운 피벗 테이블 생성
            combined_share = share_df.groupby(['date', 'exchange_base'])[
                'market_share_pct'].sum().reset_index()
            combined_volume = volume_df.groupby(['date', 'exchange_base'])[
                'volume_usd'].sum().reset_index()

            dominance_pivot = combined_share.pivot(
                index='date', columns='exchange_base', values='market_share_pct').fillna(0)
            volume_pivot = combined_volume.pivot(
                index='date', columns='exchange_base', values='volume_usd').fillna(0)

            # KR/Non-KR 그룹화 (합친 데이터 기준)
            krw_cols = [col for col in dominance_pivot.columns if any(
                ex in col for ex in krw_exchanges)]
            non_krw_cols = [col for col in dominance_pivot.columns if any(
                ex in col for ex in non_krw_exchanges)]

            grouped_dom = pd.DataFrame({
                'KR': dominance_pivot[krw_cols].sum(axis=1),
                'Non-KR': dominance_pivot[non_krw_cols].sum(axis=1)
            })
            grouped_vol = pd.DataFrame({
                'KR': volume_pivot[krw_cols].sum(axis=1),
                'Non-KR': volume_pivot[non_krw_cols].sum(axis=1)
            })

        total_kr_non_kr_vol = grouped_vol['KR'] + grouped_vol['Non-KR']

        # 1-2. KR vs Non-KR Dominance(%) + 전체 거래량 bar chart (subplot)
        mode_title = "Spot Only" if volume_mode == "Spot Only" else "Spot + Perp"

        # Get available exchanges for description
        available_exchanges = combined_df['exchange'].unique()
        exchange_list = ", ".join(sorted(available_exchanges))

        st.subheader(
            f"{ticker} - KR vs Non-KR: Dominance (%) & Total Volume ({mode_title})")
        st.caption(f"📊 Data from: {exchange_list}")

        # Display current price
        if current_price > 0:
            st.metric("Current Price", f"${current_price:,.4f}")

        fig_spot_perp = make_subplots(
            rows=2, cols=1, shared_xaxes=True, row_heights=[0.7, 0.3], vertical_spacing=0.05,
            subplot_titles=("Dominance (%)", "Total Volume (USD) - Bar Chart"),
            specs=[[{"secondary_y": True}], [{}]]
        )
        # Row 1: Dominance stacked bar (y1) + close price (y2)
        fig_spot_perp.add_trace(go.Bar(
            name='KR',
            x=grouped_dom.index.astype(str),
            y=grouped_dom['KR'],
            marker_color='royalblue',
            opacity=1.0
        ), row=1, col=1, secondary_y=False)

        fig_spot_perp.add_trace(go.Bar(
            name='Non-KR',
            x=grouped_dom.index.astype(str),
            y=grouped_dom['Non-KR'],
            marker_color='orange',
            opacity=1.0
        ), row=1, col=1, secondary_y=False)

        # Add close price line
        if not price_df.empty:
            fig_spot_perp.add_trace(go.Scatter(
                x=price_df.index.astype(str),
                y=price_df['close'],
                name='Close Price',
                mode='lines+markers',
                line=dict(color='black', width=2),
                yaxis='y2'
            ), row=1, col=1, secondary_y=True)
        # Row 2: 전체 거래량 bar chart (단일)
        fig_spot_perp.add_trace(go.Bar(
            x=total_kr_non_kr_vol.index.astype(str),
            y=total_kr_non_kr_vol,
            name='Total Volume',
            marker_color='rgba(44, 160, 101, 0.8)',
            opacity=0.8
        ), row=2, col=1)

        fig_spot_perp.update_layout(
            barmode='stack',
            height=650,
            margin=dict(l=40, r=40, t=40, b=40),
            legend=dict(x=1.05, y=1),
        )
        fig_spot_perp.update_yaxes(
            title_text='Market Share (%)', row=1, col=1, secondary_y=False)
        fig_spot_perp.update_yaxes(
            title_text='Close Price', row=1, col=1, secondary_y=True)
        fig_spot_perp.update_yaxes(
            title_text='Total Volume (USD)', row=2, col=1)
        fig_spot_perp.update_xaxes(
            rangeslider=dict(visible=False), row=1, col=1)
        st.plotly_chart(fig_spot_perp, use_container_width=True)

        # 3-4. CEX별 Dominance(%) + 전체 거래량 bar chart (subplot)
        st.subheader(f"{ticker} - Exchange: Dominance (%) & Total Volume")
        total_cex_vol = volume_pivot.sum(axis=1)
        fig_cex = make_subplots(
            rows=2, cols=1, shared_xaxes=True, row_heights=[0.7, 0.3], vertical_spacing=0.05,
            subplot_titles=("Dominance (%)", "Total Volume (USD) - Bar Chart"),
            specs=[[{"secondary_y": True}], [{}]]
        )
        # Row 1: Dominance stacked bar (y1) + close price (y2)
        bar_traces = []
        for exchange in dominance_pivot.columns:
            bar_traces.append(go.Bar(
                name=exchange,
                x=dominance_pivot.index.astype(str),
                y=dominance_pivot[exchange],
                marker_color=exchange_colors.get(exchange, None),
                opacity=1.0
            ))

        # Add all bar traces
        for bar in bar_traces:
            fig_cex.add_trace(bar, row=1, col=1, secondary_y=False)

        # Add close price line if available
        if not price_df.empty:
            price_trace = go.Scatter(
                x=price_df.index.astype(str),
                y=price_df['close'],
                name='Close Price',
                mode='lines+markers',
                line=dict(color='black', width=2),
                yaxis='y2'
            )
            fig_cex.add_trace(price_trace, row=1, col=1, secondary_y=True)
        # Row 2: 전체 거래량 bar chart (단일)
        fig_cex.add_trace(go.Bar(
            x=total_cex_vol.index.astype(str),
            y=total_cex_vol,
            name='Total Volume',
            marker_color='rgba(44, 160, 101, 0.8)',
            opacity=0.8
        ), row=2, col=1)

        fig_cex.update_layout(
            barmode='stack',
            height=650,
            margin=dict(l=40, r=40, t=40, b=40),
            legend=dict(x=1.05, y=1),
        )
        fig_cex.update_yaxes(title_text='Market Share (%)',
                             row=1, col=1, secondary_y=False)
        fig_cex.update_yaxes(title_text='Close Price',
                             row=1, col=1, secondary_y=True)
        fig_cex.update_yaxes(title_text='Total Volume (USD)', row=2, col=1)
        fig_cex.update_xaxes(rangeslider=dict(visible=False), row=1, col=1)
        st.plotly_chart(fig_cex, use_container_width=True)

        # Table: Exchange volume (moved below charts)
        st.subheader(f"{ticker} - {days}-Day Exchange Volume Table")
        volume_table = combined_df.pivot(
            index='date', columns='exchange', values='volume_usd').fillna(0).round(2)
        st.dataframe(volume_table)
    else:
        st.warning(f"No historical data available for {ticker}.")
        st.info(
            "💡 Try a different ticker or check if the token is listed on major exchanges.")
else:
    st.info("Please enter a token ticker to view data.")
