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

  let badgeColor = 'bg-bia-navy-800 text-slate-300 border-bia-navy-700';

  if (!isZero) {
    if (value > 15 || isSeverityCritical) {
      badgeColor = 'bg-bia-coral/15 text-bia-coral border-bia-coral/30';
    } else if (value > 5) {
      badgeColor = 'bg-bia-amber/15 text-bia-amber border-bia-amber/30';
    } else if (value < -15) {
      badgeColor = 'bg-bia-purple/15 text-bia-purple border-bia-purple/30';
    } else {
      badgeColor = 'bg-bia-turquoise/15 text-bia-turquoise border-bia-turquoise/30';
    }
  }

  const formatted = isPositive ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono font-bold rounded-md border px-2 py-0.5 tracking-tight transition-colors',
        size === 'sm' ? 'text-[11px]' : 'text-xs',
        badgeColor,
        className
      )}
    >
      {isZero ? (
        <Minus className="w-3 h-3 opacity-70" />
      ) : isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      <span>{formatted}</span>
    </span>
  );
};
