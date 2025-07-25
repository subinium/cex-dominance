# Exchange Dominance Dashboard

A Streamlit dashboard for analyzing cryptocurrency exchange dominance and volume data across major exchanges.

## Features

- **Multi-Exchange Support**: Binance, Bybit, OKX, KuCoin, Coinbase, Kraken, Upbit, Bithumb
- **Spot & Perpetual Futures**: Compare spot-only vs spot+perpetual volume modes
- **KR vs Non-KR Analysis**: Separate analysis for Korean and international exchanges
- **Historical Data**: Up to 60 days of historical volume and price data (accurate daily data)
- **Real-time Price**: Current price fetching from major exchanges
- **Interactive Charts**: Plotly-based interactive visualizations with bar charts
- **Optimized Performance**: Fast data fetching with minimal delays
- **Accurate Comparisons**: Uses only historical daily data to avoid inflated volume comparisons

## Performance Optimizations

### ⚡ Optimized Settings

- **Reduced timeouts**: 10 seconds (from 30 seconds)
- **Faster rate limiting**: 100ms between requests (from 1000ms)
- **Minimal retry logic**: 2 retries with exponential backoff
- **Efficient error handling**: Graceful degradation when exchanges fail

### 🚀 Streamlit Cloud Optimized

- **Session state caching** for repeated requests
- **Progress indicators** with detailed status updates
- **Resource-efficient** operations
- **Fast loading times** (10-20 seconds typical)

## Deployment

### Streamlit Cloud Deployment

1. **Fork/Clone** this repository
2. **Deploy to Streamlit Cloud**:
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Connect your GitHub repository
   - Set the main file path to `app.py`
   - Deploy

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
streamlit run app.py
```

## Troubleshooting

### Common Issues

1. **Some exchanges not loading data (especially Binance/Bybit)**:

   - This is normal due to rate limiting and network issues
   - The app now includes retry mechanisms and better error handling
   - Binance and Bybit have stricter rate limits - the app will retry automatically
   - Try refreshing the page or waiting a few minutes between requests

2. **Price data not loading**:

   - Check if the token is listed on major exchanges
   - Some tokens may not be available on all exchanges
   - The app will show warnings for missing data
   - Added more exchange sources for price data (now includes Bybit, OKX)
   - Falls back to latest historical price if current price unavailable

3. **Volume data accuracy**:

   - The app now uses only historical daily data for accurate comparisons
   - Today's volume data is excluded to avoid inflated comparisons with 24h data
   - This ensures fair comparison between different days

4. **Slow loading**:

   - The app fetches data from multiple exchanges sequentially
   - First load may take 15-30 seconds (increased timeouts for better reliability)
   - Subsequent loads will be faster due to caching
   - Added progress indicators to show current status

5. **Deployment issues**:
   - Increased timeouts and rate limits for better deployment stability
   - Added retry mechanisms with exponential backoff
   - Better error handling prevents app crashes
   - Graceful degradation when some exchanges fail

### Performance Tips

- Use shorter time periods (7-14 days) for faster loading
- Try "Spot Only" mode first, then "Spot+Perp" if needed
- The app automatically retries failed API calls with exponential backoff
- Increased timeouts and rate limits for better reliability
- Better error handling ensures the app continues working even if some exchanges fail

## Configuration

### Environment Variables

Most exchanges don't require API keys for public data. If you need higher rate limits:

1. Create API keys on the respective exchanges
2. Add them to `.streamlit/secrets.toml`
3. Uncomment the relevant lines in `main.py`

### Supported Tokens

The app works with any token that has trading pairs on the supported exchanges. Common examples:

- SOL, BTC, ETH, PENGU, etc.

## Technical Details

- **Backend**: CCXT library for exchange API integration
- **Frontend**: Streamlit with Plotly charts
- **Data Processing**: Pandas for data manipulation
- **Error Handling**: Retry logic and graceful degradation
- **Caching**: Session state caching for better performance
- **Optimization**: Reduced timeouts and rate limits for speed

## Performance Comparison

| Feature          | Before      | After                   | Improvement         |
| ---------------- | ----------- | ----------------------- | ------------------- |
| Timeout          | 10 seconds  | 20-30 seconds           | Better reliability  |
| Rate Limit       | 100ms       | 150-300ms               | Better stability    |
| Retry Logic      | None        | 3 attempts with backoff | Better success rate |
| Error Recovery   | Basic       | Graceful degradation    | Better UX           |
| Exchange Support | 8 exchanges | 8 exchanges + retry     | More reliable data  |

## Contributing

Feel free to submit issues and enhancement requests!
