'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { EXCHANGE_COLORS, KRW_EXCHANGES, NON_KRW_EXCHANGES } from '@/types';

interface ChartDataItem {
  date: string;
  [key: string]: number | string;
}

interface DominanceChartProps {
  data: ChartDataItem[];
  priceData: { date: string; close: number }[];
  exchanges: string[];
  mode: 'kr-nonkr' | 'exchange';
  volumeMode: 'spot' | 'spot+perp';
}

const formatNumber = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-gray-300">{entry.name}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {typeof entry.value === 'number'
                ? entry.name === 'Price'
                  ? `$${entry.value.toFixed(4)}`
                  : `${entry.value.toFixed(2)}%`
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DominanceChart({
  data,
  priceData,
  exchanges,
  mode,
  volumeMode,
}: DominanceChartProps) {
  // Merge price data with dominance data
  const mergedData = data.map((item) => {
    const priceItem = priceData.find((p) => p.date === item.date);
    return {
      ...item,
      price: priceItem?.close || 0,
    };
  });

  const getExchangesForMode = () => {
    if (mode === 'kr-nonkr') {
      return ['KR', 'Non-KR'];
    }
    // Filter based on volumeMode
    if (volumeMode === 'spot') {
      return exchanges.filter((ex) => !ex.includes('_perp'));
    }
    // For spot+perp, aggregate by base exchange
    const baseExchanges = new Set(exchanges.map((ex) => ex.replace('_perp', '')));
    return Array.from(baseExchanges);
  };

  const displayExchanges = getExchangesForMode();

  const getBarColor = (exchange: string): string => {
    if (exchange === 'KR') return '#3B82F6';
    if (exchange === 'Non-KR') return '#F97316';
    return EXCHANGE_COLORS[exchange.replace('_perp', '')] || '#6B7280';
  };

  // Get max price for Y-axis scale
  const maxPrice = Math.max(...priceData.map((p) => p.close), 0);

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={mergedData}
          margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickFormatter={(value) => `$${value.toFixed(2)}`}
            domain={[0, maxPrice * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span className="text-sm font-medium capitalize">{value}</span>
            )}
          />

          {displayExchanges.map((exchange) => (
            <Bar
              key={exchange}
              yAxisId="left"
              dataKey={exchange}
              stackId="dominance"
              fill={getBarColor(exchange)}
              name={exchange}
              radius={[0, 0, 0, 0]}
            />
          ))}

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="price"
            stroke="#000000"
            strokeWidth={2}
            dot={{ fill: '#000000', r: 3 }}
            name="Price"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
