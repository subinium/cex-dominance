# CEX Dominance

Track Korean exchange trading volume dominance vs global exchanges in real-time.

## What is this?

CEX Dominance tracks the market share of Korean cryptocurrency exchanges (Upbit, Bithumb) compared to global exchanges (Binance, Coinbase, OKX, Bybit, Kraken, KuCoin). This helps analyze Korean market sentiment and trading activity relative to the global crypto market.

## Features

- **Real-time volume tracking** - Spot and perpetual futures data
- **Multi-asset support** - BTC, ETH, and any crypto ticker
- **Flexible timeframes** - 7D to 1Y with daily/weekly/monthly aggregation
- **Exchange breakdown** - Individual exchange market share visualization
- **Price correlation** - KR dominance vs price movement analysis
- **Dark/Light mode** - Notion-inspired color palette

## Exchanges

**Korean (KRW)**
- Upbit
- Bithumb

**Global (USD)**
- Binance
- Coinbase
- OKX
- Bybit
- Kraken
- KuCoin

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Recharts
- CCXT (exchange APIs)
- Tailwind CSS

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

- `GET /api/dominance?ticker=BTC&days=30` - Volume dominance data
- `GET /api/reference?days=30` - BTC/ETH reference data

## Authors

- [@cptn3mox](https://twitter.com/cptn3mox)
- [@subinium](https://twitter.com/subinium)

## License

MIT
