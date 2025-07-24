# Exchange Dominance Dashboard

A Streamlit dashboard for analyzing cryptocurrency exchange dominance and volume data across major exchanges.

## Features

- **Multi-Exchange Support**: Binance, Bybit, OKX, KuCoin, Coinbase, Kraken, Upbit, Bithumb
- **Spot & Perpetual Futures**: Compare spot-only vs spot+perpetual volume modes
- **KR vs Non-KR Analysis**: Separate analysis for Korean and international exchanges
- **Historical Data**: Up to 60 days of historical volume and price data
- **Real-time Price**: Current price fetching from major exchanges
- **Interactive Charts**: Plotly-based interactive visualizations
- **Optimized Performance**: Fast data fetching with minimal delays

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

1. **Some exchanges not loading data**:

   - This is normal due to rate limiting and network issues
   - The app will show which exchanges are available/missing
   - Try refreshing the page or waiting a few minutes

2. **Price data not loading**:

   - Check if the token is listed on major exchanges
   - Some tokens may not be available on all exchanges
   - The app will show warnings for missing data

3. **Slow loading**:
   - The app fetches data from multiple exchanges sequentially
   - First load may take 10-20 seconds
   - Subsequent loads will be faster due to caching

### Performance Tips

- Use shorter time periods (7-14 days) for faster loading
- Try "Spot Only" mode first, then "Spot+Perp" if needed
- The app automatically retries failed API calls
- Optimized settings minimize delays between requests

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

| Feature        | Before     | After      | Improvement   |
| -------------- | ---------- | ---------- | ------------- |
| Timeout        | 30 seconds | 10 seconds | 3x faster     |
| Rate Limit     | 1000ms     | 100ms      | 10x faster    |
| Retry Logic    | 3 attempts | 2 attempts | Less overhead |
| Error Recovery | Basic      | Optimized  | Better UX     |

## Contributing

Feel free to submit issues and enhancement requests!
