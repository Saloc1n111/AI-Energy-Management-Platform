import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TremorDeltaBadge } from '../tremor/TremorDeltaBadge';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: ReactNode;
  delta?: number; // e.g. +110.7 or -1.4
  isSeverityCritical?: boolean;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  delta,
  isSeverityCritical = false,
  className,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 sm:p-5 transition-all duration-150 text-slate-100 shadow-sm',
        onClick ? 'cursor-pointer hover:border-bia-turquoise/40 hover:bg-bia-navy-800' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
              {value}
            </span>
            {unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
          </div>
        </div>

        {icon && (
          <div className="p-2 rounded-lg bg-bia-navy-950 border border-bia-navy-750 text-bia-turquoise">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || delta !== undefined) && (
        <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-bia-navy-750/80 text-xs">
          {delta !== undefined && (
            <TremorDeltaBadge value={delta} isSeverityCritical={isSeverityCritical} size="sm" />
          )}
          {subtitle && (
            <span className="text-slate-400 truncate text-[11px] font-medium ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
