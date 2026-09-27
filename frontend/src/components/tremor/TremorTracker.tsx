import React from 'react';
import { cn } from '../../lib/utils';

export interface TrackerBlock {
  key: string | number;
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'slate';
  tooltip?: string;
}

interface TremorTrackerProps {
  data: TrackerBlock[];
  className?: string;
}

export const TremorTracker: React.FC<TremorTrackerProps> = ({ data, className }) => {
  const colorMap = {
    emerald: 'bg-emerald-500/80 hover:bg-emerald-500 dark:bg-bia-turquoise/80 dark:hover:bg-bia-turquoise',
    rose: 'bg-rose-500 hover:bg-rose-600 dark:bg-bia-coral dark:hover:bg-rose-400',
    amber: 'bg-amber-400 hover:bg-amber-500 dark:bg-bia-amber dark:hover:bg-amber-300',
    purple: 'bg-purple-500 hover:bg-purple-600 dark:bg-bia-purple dark:hover:bg-purple-400',
    slate: 'bg-slate-200 hover:bg-slate-300 dark:bg-bia-navy-800 dark:hover:bg-bia-navy-750',
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-center gap-1.5 w-full h-3 overflow-hidden rounded-lg bg-slate-100 p-0.5 border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.05]">
        {data.map((block) => (
          <div
            key={block.key}
            title={block.tooltip}
            className={cn(
              'h-full flex-1 rounded-sm transition-all duration-150 cursor-pointer hover:opacity-100 hover:scale-y-110 opacity-75',
              colorMap[block.color]
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono px-0.5">
        <span>Día 01 (Inicio 14d)</span>
        <span>Día 07 (Calibración Baseline)</span>
        <span>Día 14 (Cierre)</span>
      </div>
    </div>
  );
};
