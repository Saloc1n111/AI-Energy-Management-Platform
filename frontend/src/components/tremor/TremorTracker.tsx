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
    emerald: 'bg-bia-turquoise/80 hover:bg-bia-turquoise',
    rose: 'bg-bia-coral hover:bg-rose-400',
    amber: 'bg-bia-amber hover:bg-amber-300',
    purple: 'bg-bia-purple hover:bg-purple-400',
    slate: 'bg-bia-navy-800 hover:bg-bia-navy-750',
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-center gap-1 w-full h-3 overflow-hidden rounded-md bg-bia-navy-950 p-0.5 border border-bia-navy-750">
        {data.map((block) => (
          <div
            key={block.key}
            title={block.tooltip}
            className={cn(
              'h-full flex-1 rounded-[2px] transition-opacity duration-150 cursor-pointer hover:opacity-100 opacity-80',
              colorMap[block.color]
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-0.5">
        <span>Día 01 (Inicio 14d)</span>
        <span>Día 07 (Calibración Baseline)</span>
        <span>Día 14 (Cierre)</span>
      </div>
    </div>
  );
};
