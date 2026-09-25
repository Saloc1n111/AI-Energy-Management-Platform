import React from 'react';
import { cn } from '../../lib/utils';

interface TremorProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  sublabel?: string;
  color?: 'cyan' | 'emerald' | 'rose' | 'amber' | 'indigo';
  className?: string;
}

export const TremorProgressBar: React.FC<TremorProgressBarProps> = ({
  value,
  label,
  sublabel,
  color = 'cyan',
  className,
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  const barColors = {
    cyan: 'bg-gradient-to-r from-cyan-600 to-cyan-400',
    emerald: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
    rose: 'bg-gradient-to-r from-rose-600 to-rose-400',
    amber: 'bg-gradient-to-r from-amber-600 to-amber-400',
    indigo: 'bg-gradient-to-r from-indigo-600 to-indigo-400',
  }[color];

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-semibold text-slate-300">{label}</span>}
          {sublabel && <span className="font-mono text-slate-400">{sublabel}</span>}
        </div>
      )}

      <div className="w-full h-2 rounded-full bg-slate-800/80 p-0.5 border border-slate-700/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', barColors)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
