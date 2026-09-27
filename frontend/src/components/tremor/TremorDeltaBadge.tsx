import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TremorDeltaBadgeProps {
  value: number; // percentage value, e.g. 110.7, -1.4
  isSeverityCritical?: boolean; // if high variation represents a risk
  size?: 'sm' | 'md';
  className?: string;
}

export const TremorDeltaBadge: React.FC<TremorDeltaBadgeProps> = ({
  value,
  isSeverityCritical = false,
  size = 'md',
  className,
}) => {
  const isZero = Math.abs(value) < 0.1;
  const isPositive = value > 0;

  let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.06]';

  if (!isZero) {
    if (value > 15 || isSeverityCritical) {
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-bia-coral/[0.08] dark:text-bia-coral dark:border-bia-coral/25';
    } else if (value > 5) {
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-bia-amber/[0.08] dark:text-bia-amber dark:border-bia-amber/25';
    } else if (value < -15) {
      badgeColor = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-bia-purple/[0.08] dark:text-bia-purple dark:border-bia-purple/25';
    } else {
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/25';
    }
  }

  const formatted = isPositive ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono font-medium rounded-full border px-2 py-0.5 tracking-tight transition-colors',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        badgeColor,
        className
      )}
    >
      {isZero ? (
        <Minus className="w-3 h-3 opacity-60" />
      ) : isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      <span>{formatted}</span>
    </span>
  );
};
