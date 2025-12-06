'use client';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  color = 'text-gray-900',
  icon,
}: StatsCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className={`text-2xl font-bold ${color} dark:text-white mt-1`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        )}
      </div>
    </div>
  );
}
