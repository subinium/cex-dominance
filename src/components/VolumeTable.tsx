'use client';

import { EXCHANGE_COLORS } from '@/types';

interface VolumeTableProps {
  data: { date: string; [exchange: string]: number | string }[];
  exchanges: string[];
}

const formatVolume = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

export default function VolumeTable({ data, exchanges }: VolumeTableProps) {
  // Sort data by date descending
  const sortedData = [...data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
              Date
            </th>
            {exchanges.map((exchange) => (
              <th
                key={exchange}
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider"
                style={{
                  color: EXCHANGE_COLORS[exchange.replace('_perp', '')] || '#6B7280',
                }}
              >
                {exchange}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedData.map((row, idx) => {
            const total = exchanges.reduce(
              (sum, ex) => sum + (typeof row[ex] === 'number' ? (row[ex] as number) : 0),
              0
            );
            return (
              <tr
                key={row.date}
                className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-inherit z-10">
                  {row.date}
                </td>
                {exchanges.map((exchange) => (
                  <td
                    key={exchange}
                    className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300"
                  >
                    {typeof row[exchange] === 'number' && row[exchange] > 0
                      ? formatVolume(row[exchange] as number)
                      : '-'}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatVolume(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
