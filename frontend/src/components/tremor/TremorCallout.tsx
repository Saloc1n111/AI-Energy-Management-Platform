import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface TremorCalloutProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  color?: 'cyan' | 'emerald' | 'rose' | 'amber';
  action?: ReactNode;
  className?: string;
}

export const TremorCallout: React.FC<TremorCalloutProps> = ({
  title,
  children,
  icon,
  color = 'cyan',
  action,
  className,
}) => {
  const colorStyles = {
    cyan: {
      card: 'bg-cyan-50/70 border-cyan-200 text-slate-800 dark:bg-bia-turquoise/[0.04] dark:border-bia-turquoise/20 dark:text-slate-200',
      title: 'text-cyan-800 dark:text-bia-turquoise',
      icon: <Info className="w-4 h-4 text-cyan-600 dark:text-bia-turquoise shrink-0" />,
    },
    emerald: {
      card: 'bg-emerald-50/70 border-emerald-200 text-slate-800 dark:bg-emerald-500/[0.04] dark:border-emerald-500/20 dark:text-slate-200',
      title: 'text-emerald-800 dark:text-emerald-400',
      icon: <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    },
    rose: {
      card: 'bg-rose-50/70 border-rose-200 text-slate-800 dark:bg-bia-coral/[0.05] dark:border-bia-coral/20 dark:text-rose-100',
      title: 'text-rose-800 dark:text-bia-coral',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-bia-coral shrink-0" />,
    },
    amber: {
      card: 'bg-amber-50/70 border-amber-200 text-slate-800 dark:bg-bia-amber/[0.05] dark:border-bia-amber/20 dark:text-amber-100',
      title: 'text-amber-800 dark:text-bia-amber',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-bia-amber shrink-0" />,
    },
  }[color];

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 transition-all backdrop-blur-sm',
        colorStyles.card,
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon || colorStyles.icon}
        <div className="space-y-1">
          <h4 className={cn('text-xs font-bold uppercase tracking-wider', colorStyles.title)}>
            {title}
          </h4>
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {children}
          </div>
        </div>
      </div>

      {action && <div className="shrink-0 self-end sm:self-center">{action}</div>}
    </div>
  );
};
