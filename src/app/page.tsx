'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Cell,
  ReferenceLine,
  Legend,
  BarChart,
} from 'recharts';
import { VolumeData, KRW_EXCHANGES, EXCHANGE_COLORS } from '@/types';

type VolumeMode = 'spot' | 'spot+perp';
type TimeFrame = 'D' | 'W' | 'M';
type RefTab = 'BTC' | 'ETH';

interface ApiResponse {
  success: boolean;
  data?: VolumeData[];
  currentPrice?: number;
  error?: string;
}

interface RefData {
  date: string;
  btcPrice: number;
  ethPrice: number;
  btcKrDom: number;
  ethKrDom: number;
}

interface RefResponse {
  success: boolean;
  data?: RefData[];
  btcKrDominance?: number;
  ethKrDominance?: number;
}

type ChartDataItem = { date: string; [key: string]: number | string };

const DEFAULT_TICKER = 'BTC';
const DEFAULT_DAYS = 30;

const LOADING_MESSAGES = [
  'Connecting to exchanges',
  'Fetching volume data',
  'Processing market data',
  'Calculating dominance',
  'Almost ready',
];

const formatNumber = (num: number, decimals = 2): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  return num.toFixed(decimals);
};

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
};

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const InfoTooltip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <span
        className="info-tooltip"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        i
      </span>
      {show && (
        <div
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg shadow-lg whitespace-nowrap"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          {text}
          <div
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--bg-tertiary)' }}
          />
        </div>
      )}
    </span>
  );
};

export default function Home() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [inputValue, setInputValue] = useState(DEFAULT_TICKER);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('D');
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('spot');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VolumeData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isDark, setIsDark] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [rawDataOpen, setRawDataOpen] = useState(false);
  const [refTab, setRefTab] = useState<RefTab>('BTC');

  // Reference data (BTC/ETH 90 days)
  const [refData, setRefData] = useState<RefData[]>([]);
  const [btcKrDom, setBtcKrDom] = useState<number | null>(null);
  const [ethKrDom, setEthKrDom] = useState<number | null>(null);
  const [refLoading, setRefLoading] = useState(true);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = theme === 'dark' || (!theme && prefersDark);
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Fetch BTC/ETH reference data
  useEffect(() => {
    const fetchRefData = async () => {
      try {
        setRefLoading(true);
        const res = await fetch('/api/reference');
        const json: RefResponse = await res.json();
        if (json.success && json.data) {
          setRefData(json.data);
          setBtcKrDom(json.btcKrDominance || null);
          setEthKrDom(json.ethKrDominance || null);
        }
      } catch (err) {
        console.error('Failed to fetch reference data:', err);
      } finally {
        setRefLoading(false);
      }
    };
    fetchRefData();
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDark);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingMessage(LOADING_MESSAGES[0]);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        const newProgress = Math.min(prev + Math.random() * 15, 90);
        const messageIndex = Math.min(Math.floor(newProgress / 20), LOADING_MESSAGES.length - 1);
        setLoadingMessage(LOADING_MESSAGES[messageIndex]);
        return newProgress;
      });
    }, 800);

    try {
      const res = await fetch(`/api/dominance?ticker=${ticker}&days=${days}`);
      const json: ApiResponse = await res.json();

      clearInterval(progressInterval);
      setLoadingProgress(100);
      setLoadingMessage('Complete');

      if (!json.success) {
        setError(json.error || 'Failed to fetch data');
        setData([]);
        return;
      }

      setData(json.data || []);
      setCurrentPrice(json.currentPrice || 0);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Network error');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTimeFrameChange = (tf: TimeFrame) => {
    setTimeFrame(tf);
    if (tf === 'D') setDays(30);
    else if (tf === 'W') setDays(90);
    else if (tf === 'M') setDays(365);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearch = () => {
    const newTicker = inputValue.trim().toUpperCase();
    if (newTicker) {
      if (newTicker !== ticker) {
        setTicker(newTicker);
        setHiddenSeries(new Set());
      } else {
        fetchData();
      }
    }
  };

  const toggleSeries = (seriesName: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesName)) {
        next.delete(seriesName);
      } else {
        next.add(seriesName);
      }
      return next;
    });
  };

  const processedData = useMemo(() => {
    if (data.length === 0) return { chartData: [], stats: null, exchanges: [] };

    const filteredData = volumeMode === 'spot' ? data.filter((d) => d.type === 'spot') : data;
    const dates = [...new Set(filteredData.map((d) => d.date))].sort();

    const dailyTotals: Record<string, number> = {};
    const dailyKr: Record<string, number> = {};
    const dailyNonKr: Record<string, number> = {};
    const dailyPrice: Record<string, number> = {};
    const exchangeVolumes: Record<string, Record<string, number>> = {};

    for (const item of filteredData) {
      const baseExchange = item.exchange.replace('_perp', '');
      dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.volumeUsd;

      if (KRW_EXCHANGES.includes(baseExchange)) {
        dailyKr[item.date] = (dailyKr[item.date] || 0) + item.volumeUsd;
      } else {
        dailyNonKr[item.date] = (dailyNonKr[item.date] || 0) + item.volumeUsd;
      }

      if (!dailyPrice[item.date] && item.close) {
        dailyPrice[item.date] = item.close;
      }

      if (!exchangeVolumes[item.date]) exchangeVolumes[item.date] = {};
      exchangeVolumes[item.date][baseExchange] =
        (exchangeVolumes[item.date][baseExchange] || 0) + item.volumeUsd;
    }

    const chartData: ChartDataItem[] = [];
    let prevKrDominance = 0;
    let prevPrice = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const total = dailyTotals[date] || 1;
      const krDominance = ((dailyKr[date] || 0) / total) * 100;
      const krChange = i === 0 ? 0 : krDominance - prevKrDominance;
      const price = dailyPrice[date] || prevPrice;
      const priceChange = i === 0 ? 0 : prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
      prevKrDominance = krDominance;
      prevPrice = price;

      const item: ChartDataItem = {
        date,
        dateShort: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        krDominance,
        krChange,
        nonKrDominance: 100 - krDominance,
        totalVolume: total,
        krVolume: dailyKr[date] || 0,
        nonKrVolume: dailyNonKr[date] || 0,
        price,
        priceChange,
      };

      const exchanges = exchangeVolumes[date] || {};
      for (const [ex, vol] of Object.entries(exchanges)) {
        item[ex] = (vol / total) * 100;
        item[`${ex}Vol`] = vol;
      }

      chartData.push(item);
    }

    const latestKr = chartData.length > 0 ? Number(chartData[chartData.length - 1].krDominance) : 0;
    const firstKr = chartData.length > 0 ? Number(chartData[0].krDominance) : 0;
    const krTrend = latestKr - firstKr;
    const avgKr = chartData.reduce((sum, d) => sum + Number(d.krDominance), 0) / chartData.length;
    const totalVol = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
    const avgDailyVol = totalVol / dates.length;
    const latestPrice = chartData.length > 0 ? Number(chartData[chartData.length - 1].price) : 0;
    const firstPrice = chartData.length > 0 ? Number(chartData[0].price) : 0;
    const priceChange = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;

    const krDominances = chartData.map((d) => Number(d.krDominance));
    const maxKr = Math.max(...krDominances);
    const minKr = Math.min(...krDominances);

    return {
      chartData,
      stats: { latestKr, krTrend, avgKr, maxKr, minKr, totalVol, avgDailyVol, latestPrice, priceChange },
      exchanges: [...new Set(filteredData.map((d) => d.exchange.replace('_perp', '')))],
    };
  }, [data, volumeMode]);

  const { chartData, stats, exchanges } = processedData;

  // Process reference data for chart
  const refChartData = useMemo(() => {
    return refData.map(d => ({
      ...d,
      dateShort: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [refData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;

    return (
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {payload.map((entry: { value: string; color?: string }, index: number) => {
          const isHidden = hiddenSeries.has(entry.value);
          return (
            <button
              key={index}
              onClick={() => toggleSeries(entry.value)}
              className="flex items-center gap-1.5 transition-all"
              style={{ opacity: isHidden ? 0.4 : 1 }}
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: isHidden ? 'var(--text-muted)' : entry.color,
                  border: isHidden ? '1px dashed var(--text-muted)' : 'none',
                }}
              />
              <span style={{ color: 'var(--text-secondary)', textDecoration: isHidden ? 'line-through' : 'none' }}>
                {entry.value}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const d = chartData.find((d) => d.date === label || d.dateShort === label);
    if (!d) return null;

    return (
      <div className="card p-3 text-xs font-mono shadow-lg border" style={{ borderColor: 'var(--border)' }}>
        <div style={{ color: 'var(--text-muted)' }} className="mb-2 font-semibold">{d.date}</div>
        <div className="space-y-1">
          {payload.map((p, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span style={{ color: p.color }}>{p.name}</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {p.name.includes('Vol') || p.name === 'Volume'
                  ? `$${formatNumber(p.value)}`
                  : p.name.includes('Price') && !p.name.includes('Chg')
                  ? formatPrice(p.value)
                  : `${p.value.toFixed(2)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              CEX Dominance
              <InfoTooltip text="Track Korean exchange volume dominance across major CEXs" />
            </h1>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="TICKER"
                className="w-20 bg-transparent border px-2 py-1 text-sm font-mono focus:outline-none focus:border-[var(--accent)] rounded"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-3 py-1 text-xs font-medium rounded transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                {loading ? '...' : 'Search'}
              </button>

              {/* D/W/M Selector */}
              <div className="flex items-center gap-1 ml-2">
                {(['D', 'W', 'M'] as TimeFrame[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeFrameChange(tf)}
                    className={`time-btn ${timeFrame === tf ? 'time-btn-active' : ''}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* KR Dominance indicators */}
            <div className="flex items-center gap-3">
              {btcKrDom !== null && (
                <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--chart-btc)' }}>BTC</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>KR</span>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {btcKrDom.toFixed(1)}%
                  </span>
                </div>
              )}
              {ethKrDom !== null && (
                <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--chart-eth)' }}>ETH</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>KR</span>
                  <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {ethKrDom.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['spot', 'spot+perp'] as VolumeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVolumeMode(mode)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: volumeMode === mode ? 'var(--accent)' : 'transparent',
                    color: volumeMode === mode ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {mode === 'spot' ? 'Spot' : 'Spot+Perp'}
                </button>
              ))}
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-4 py-4">
        {/* BTC/ETH Reference Chart with Tabs */}
        {!refLoading && refChartData.length > 0 && (
          <div className="card p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {(['BTC', 'ETH'] as RefTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRefTab(tab)}
                      className={`mini-tab ${refTab === tab ? 'mini-tab-active' : 'mini-tab-inactive'}`}
                      style={{ color: refTab === tab ? (tab === 'BTC' ? 'var(--chart-btc)' : 'var(--chart-eth)') : undefined }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Price & KR Dominance (90D)
                </span>
                <InfoTooltip text="Shows price trend and Korean exchange dominance for the selected asset over 90 days" />
              </div>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={refChartData} margin={{ top: 5, right: 50, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="dateShort"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    interval={Math.floor(refChartData.length / 8)}
                  />
                  <YAxis
                    yAxisId="price"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="dom"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = refChartData.find(r => r.dateShort === label);
                      return (
                        <div className="card p-3 text-xs font-mono shadow-lg border" style={{ borderColor: 'var(--border)' }}>
                          <div style={{ color: 'var(--text-muted)' }} className="mb-2 font-semibold">{d?.date}</div>
                          <div className="space-y-1">
                            {payload.map((p, i) => (
                              <div key={i} className="flex justify-between gap-4">
                                <span style={{ color: p.color }}>{p.name}</span>
                                <span style={{ color: 'var(--text-primary)' }}>
                                  {String(p.name)?.includes('Price') ? formatPrice(Number(p.value)) : `${Number(p.value).toFixed(2)}%`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {refTab === 'BTC' && (
                    <>
                      <Line yAxisId="price" type="linear" dataKey="btcPrice" name="BTC Price" stroke="var(--chart-btc)" strokeWidth={2} dot={false} />
                      <Bar yAxisId="dom" dataKey="btcKrDom" name="BTC KR%" fill="var(--chart-btc)" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
                    </>
                  )}
                  {refTab === 'ETH' && (
                    <>
                      <Line yAxisId="price" type="linear" dataKey="ethPrice" name="ETH Price" stroke="var(--chart-eth)" strokeWidth={2} dot={false} />
                      <Bar yAxisId="dom" dataKey="ethKrDom" name="ETH KR%" fill="var(--chart-eth)" fillOpacity={0.3} radius={[2, 2, 0, 0]} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ background: refTab === 'BTC' ? 'var(--chart-btc)' : 'var(--chart-eth)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{refTab} Price</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: refTab === 'BTC' ? 'var(--chart-btc)' : 'var(--chart-eth)', opacity: 0.3 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{refTab} KR Dominance</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-64 space-y-4">
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%`, background: 'var(--accent)' }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>{loadingMessage}...</span>
                <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{Math.round(loadingProgress)}%</span>
              </div>
              <div className="text-center">
                <span className="text-lg font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{ticker}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{days}D</span>
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {['binance', 'coinbase', 'okx', 'bybit', 'upbit', 'bithumb'].map((ex, i) => (
                  <div
                    key={ex}
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{
                      background: EXCHANGE_COLORS[ex],
                      animationDelay: `${i * 150}ms`,
                      opacity: loadingProgress > i * 15 ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-32 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--red)' }}>{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && stats && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
              {[
                { label: 'Price', value: formatPrice(currentPrice || stats.latestPrice), change: stats.priceChange, showChange: true, info: 'Current market price from major exchanges' },
                { label: 'KR Dom', value: `${stats.latestKr.toFixed(2)}%`, change: stats.krTrend, showChange: true, info: 'Korean exchange share of total trading volume' },
                { label: 'Avg KR', value: `${stats.avgKr.toFixed(2)}%`, info: 'Average KR dominance over selected period' },
                { label: 'High/Low', value: `${stats.maxKr.toFixed(1)}% / ${stats.minKr.toFixed(1)}%`, info: 'Highest and lowest KR dominance in period' },
                { label: 'Total Vol', value: `$${formatNumber(stats.totalVol, 1)}`, info: 'Cumulative trading volume over period' },
                { label: 'Avg/Day', value: `$${formatNumber(stats.avgDailyVol, 1)}`, info: 'Average daily trading volume' },
              ].map((stat, i) => (
                <div key={i} className="card p-3">
                  <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center" style={{ color: 'var(--text-muted)' }}>
                    {stat.label}
                    {stat.info && <InfoTooltip text={stat.info} />}
                  </div>
                  <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</div>
                  {stat.showChange && (
                    <div className="text-xs font-mono" style={{ color: stat.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(2)}%
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* KR Dominance Change */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  KR Dominance Daily Change
                  <InfoTooltip text="Day-over-day change in Korean exchange dominance. Green = increased, Red = decreased" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                      <Bar dataKey="krChange" name="KR Change" radius={[2, 2, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={Number(entry.krChange) >= 0 ? 'var(--green)' : 'var(--red)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* KR Dominance vs Price */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  KR Dominance vs Price
                  <InfoTooltip text="Compare Korean dominance (bars) with price movement (line)" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={['auto', 'auto']} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => formatPrice(v)} domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderLegend} />
                      {!hiddenSeries.has('KR %') && (
                        <Bar yAxisId="left" dataKey="krDominance" name="KR %" fill="var(--chart-kr)" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                      )}
                      {!hiddenSeries.has('Price') && (
                        <Line yAxisId="right" type="linear" dataKey="price" name="Price" stroke="var(--chart-price)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-price)' }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* KR vs Global Share */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  KR vs Global Share
                  <InfoTooltip text="Stacked view showing Korean vs Global exchange market share (100% total)" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderLegend} />
                      {!hiddenSeries.has('KR') && (
                        <Bar dataKey="krDominance" name="KR" stackId="1" fill="var(--chart-kr)" />
                      )}
                      {!hiddenSeries.has('Global') && (
                        <Bar dataKey="nonKrDominance" name="Global" stackId="1" fill="var(--chart-global)" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume KR vs Global */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  Volume: KR vs Global
                  <InfoTooltip text="Absolute trading volume in USD split by Korean and Global exchanges" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `$${formatNumber(v, 0)}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderLegend} />
                      {!hiddenSeries.has('KR Vol') && (
                        <Bar dataKey="krVolume" name="KR Vol" stackId="vol" fill="var(--chart-kr)" />
                      )}
                      {!hiddenSeries.has('Global Vol') && (
                        <Bar dataKey="nonKrVolume" name="Global Vol" stackId="vol" fill="var(--chart-global)" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Exchange Breakdown */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  Exchange Breakdown
                  <InfoTooltip text="Individual exchange market share. Click legend items to toggle visibility" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="card p-3 text-xs font-mono shadow-lg max-h-64 overflow-auto border" style={{ borderColor: 'var(--border)' }}>
                              <div style={{ color: 'var(--text-muted)' }} className="mb-2 font-semibold">{label}</div>
                              <div className="space-y-1">
                                {payload.filter(p => !hiddenSeries.has(String(p.name) || '')).reverse().map((p, i) => (
                                  <div key={i} className="flex justify-between gap-4">
                                    <span style={{ color: p.color }}>{p.name}</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{Number(p.value).toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend content={renderLegend} />
                      {exchanges.filter(ex => !hiddenSeries.has(ex)).map((ex) => (
                        <Bar key={ex} dataKey={ex} name={ex} stackId="1" fill={EXCHANGE_COLORS[ex] || '#888'} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Price Change vs KR Change */}
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider mb-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
                  Price Change vs KR Change
                  <InfoTooltip text="Correlation between price changes and Korean dominance changes" />
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <XAxis dataKey="dateShort" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderLegend} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                      {!hiddenSeries.has('KR Chg') && (
                        <Bar dataKey="krChange" name="KR Chg" fill="var(--chart-kr)" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                      )}
                      {!hiddenSeries.has('Price Chg') && (
                        <Line type="linear" dataKey="priceChange" name="Price Chg" stroke="var(--chart-price)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-price)' }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Collapsible Raw Data Section */}
            <div className="card overflow-hidden">
              <div
                className="collapsible-header"
                onClick={() => setRawDataOpen(!rawDataOpen)}
                style={{ borderBottom: rawDataOpen ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Raw Volume Data (USD)
                  </span>
                  <InfoTooltip text="Detailed daily volume breakdown by exchange" />
                </div>
                <ChevronIcon isOpen={rawDataOpen} />
              </div>

              {rawDataOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left py-2.5 px-4 font-medium sticky left-0" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>Date</th>
                        {exchanges.map((ex) => (
                          <th key={ex} className="text-right py-2.5 px-3 font-medium capitalize" style={{ color: EXCHANGE_COLORS[ex] }}>{ex}</th>
                        ))}
                        <th className="text-right py-2.5 px-4 font-medium" style={{ color: 'var(--green)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[...chartData].reverse().slice(0, 30).map((row, i) => (
                        <tr key={row.date} style={{ background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'transparent' }}>
                          <td className="py-2 px-4 sticky left-0" style={{ color: 'var(--text-secondary)', background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)' }}>{row.date}</td>
                          {exchanges.map((ex) => (
                            <td key={ex} className="text-right py-2 px-3" style={{ color: 'var(--text-primary)' }}>
                              {row[`${ex}Vol`] ? `$${formatNumber(Number(row[`${ex}Vol`]), 1)}` : '-'}
                            </td>
                          ))}
                          <td className="text-right py-2 px-4 font-semibold" style={{ color: 'var(--green)' }}>${formatNumber(Number(row.totalVolume), 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !error && !stats && (
          <div className="py-32 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Enter a ticker and press Enter to view dominance data
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-8 px-4 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Data: Binance, Coinbase, Kraken, OKX, Bybit, KuCoin, Upbit, Bithumb</span>
          <div className="flex items-center gap-4">
            <span>Click legend to toggle</span>
            <span>
              Built by{' '}
              <a href="https://twitter.com/cptn3mox" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>@cptn3mox</a>
              {' & '}
              <a href="https://twitter.com/subinium" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>@subinium</a>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
