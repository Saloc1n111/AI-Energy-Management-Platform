import React, { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface TremorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  decoration?: 'top' | 'left' | 'none';
  decorationColor?: 'cyan' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'zinc';
  className?: string;
}

export const TremorCard: React.FC<TremorCardProps> = ({
  children,
  decoration = 'none',
  decorationColor = 'zinc',
  className,
  ...props
}) => {
  const decorationClasses = {
    top: {
      cyan: 'border-t-2 border-t-bia-turquoise',
      emerald: 'border-t-2 border-t-bia-turquoise',
      rose: 'border-t-2 border-t-bia-coral',
      amber: 'border-t-2 border-t-bia-amber',
      indigo: 'border-t-2 border-t-bia-purple',
      zinc: 'border-t-2 border-t-bia-navy-700',
    },
    left: {
      cyan: 'border-l-2 border-l-bia-turquoise',
      emerald: 'border-l-2 border-l-bia-turquoise',
      rose: 'border-l-2 border-l-bia-coral',
      amber: 'border-l-2 border-l-bia-amber',
      indigo: 'border-l-2 border-l-bia-purple',
      zinc: 'border-l-2 border-l-bia-navy-700',
    },
    none: {
      cyan: '',
      emerald: '',
      rose: '',
      amber: '',
      indigo: '',
      zinc: '',
    },
  }[decoration][decorationColor];

  return (
    <div
      className={cn(
        'relative rounded-xl bg-bia-navy-850/95 border border-bia-navy-750 p-5 shadow-sm transition-all duration-150 text-slate-100',
        decorationClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
