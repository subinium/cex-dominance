/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: 'var(--border)',
        accent: 'var(--accent)',
        exchange: {
          binance: '#F0B90B',
          coinbase: '#0052FF',
          upbit: '#0A4CFF',
          bithumb: '#F37321',
          kraken: '#5741D9',
          okx: '#FFFFFF',
          bybit: '#F7A600',
          kucoin: '#23AF91',
        },
      },
    },
  },
  plugins: [],
}
