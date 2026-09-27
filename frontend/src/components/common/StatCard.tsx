import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { TremorDeltaBadge } from '../tremor/TremorDeltaBadge';
import { Sparkles } from 'lucide-react';

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
  onAskAI?: () => void;
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
  onAskAI,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl bg-white border border-slate-200/80 shadow-xs p-4 sm:p-5 transition-all duration-200 text-slate-900 dark:bg-bia-navy-850/80 dark:border-white/[0.06] dark:text-slate-100 backdrop-blur-sm',
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm dark:hover:border-bia-turquoise/30 dark:hover:bg-bia-navy-800/50' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
              {title}
            </p>
            {onAskAI && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAI();
                }}
                title={`Preguntar a la IA sobre ${title}`}
                className="p-0.5 rounded text-slate-400 hover:text-bia-turquoise hover:bg-bia-turquoise/15 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-bia-turquoise" />
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
              {value}
            </span>
            {unit && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{unit}</span>}
          </div>
        </div>

        {icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 dark:bg-white/[0.03] dark:border-white/[0.05] dark:text-bia-turquoise flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || delta !== undefined) && (
        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-white/[0.05] text-xs">
          {delta !== undefined && (
            <TremorDeltaBadge value={delta} isSeverityCritical={isSeverityCritical} size="sm" />
          )}
          {subtitle && (
            <span className="text-slate-500 dark:text-slate-400 truncate text-[11px] font-normal ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
