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
      card: 'bg-bia-navy-850 border-bia-turquoise/30 text-slate-200',
      title: 'text-bia-turquoise',
      icon: <Info className="w-4 h-4 text-bia-turquoise shrink-0" />,
    },
    emerald: {
      card: 'bg-bia-navy-850 border-bia-turquoise/30 text-slate-200',
      title: 'text-bia-turquoise',
      icon: <CheckCircle className="w-4 h-4 text-bia-turquoise shrink-0" />,
    },
    rose: {
      card: 'bg-bia-coral/10 border-bia-coral/30 text-rose-200',
      title: 'text-bia-coral',
      icon: <AlertCircle className="w-4 h-4 text-bia-coral shrink-0" />,
    },
    amber: {
      card: 'bg-bia-amber/10 border-bia-amber/30 text-amber-200',
      title: 'text-bia-amber',
      icon: <AlertTriangle className="w-4 h-4 text-bia-amber shrink-0" />,
    },
  }[color];

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col sm:flex-row items-start justify-between gap-4 transition-colors',
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
          <div className="text-xs text-slate-300 leading-relaxed font-normal">
            {children}
          </div>
        </div>
      </div>

      {action && <div className="shrink-0 self-end sm:self-center">{action}</div>}
    </div>
  );
};
