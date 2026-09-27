import React from 'react';

interface BadgeProps {
  variant?: 'status' | 'severity' | 'type';
  value: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'status', value, size = 'md', className = '' }) => {
  const val = (value || '').toUpperCase();

  let styles = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.06]';

  if (variant === 'status') {
    switch (val) {
      case 'OK':
      case 'RESOLVED':
        styles = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/20';
        break;
      case 'ALERT':
      case 'ACKNOWLEDGED':
        styles = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-bia-amber/[0.08] dark:text-bia-amber dark:border-bia-amber/20';
        break;
      case 'CRITICAL':
      case 'OPEN':
        styles = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-bia-coral/[0.08] dark:text-bia-coral dark:border-bia-coral/20';
        break;
      case 'ONLINE':
      case 'CONNECTED':
        styles = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/[0.08] dark:text-emerald-300 dark:border-emerald-500/20';
        break;
      default:
        styles = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.06]';
    }
  } else if (variant === 'severity') {
    switch (val) {
      case 'HIGH':
        styles = 'bg-rose-50 text-rose-700 border-rose-200 font-medium dark:bg-bia-coral/[0.08] dark:text-bia-coral dark:border-bia-coral/20';
        break;
      case 'MEDIUM':
        styles = 'bg-amber-50 text-amber-700 border-amber-200 font-medium dark:bg-bia-amber/[0.08] dark:text-bia-amber dark:border-bia-amber/20';
        break;
      case 'LOW':
        styles = 'bg-cyan-50 text-cyan-700 border-cyan-200 font-medium dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/20';
        break;
      default:
        styles = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.06]';
    }
  } else if (variant === 'type') {
    switch (val) {
      case 'REAL_ANOMALY':
        styles = 'bg-rose-50 text-rose-700 border-rose-200 font-medium dark:bg-bia-coral/[0.08] dark:text-bia-coral dark:border-bia-coral/20';
        break;
      case 'DATA_QUALITY':
        styles = 'bg-purple-50 text-purple-700 border-purple-200 font-medium dark:bg-bia-purple/[0.08] dark:text-bia-purple dark:border-bia-purple/20';
        break;
      case 'EXPLAINABLE_ANOMALY':
        styles = 'bg-sky-50 text-sky-700 border-sky-200 font-medium dark:bg-sky-400/[0.08] dark:text-sky-300 dark:border-sky-400/20';
        break;
      case 'FALSE_POSITIVE':
        styles = 'bg-slate-100 text-slate-600 border-slate-200 font-medium dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/[0.06]';
        break;
      default:
        styles = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.03] dark:text-slate-300 dark:border-white/[0.06]';
    }
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-xs px-3 py-1',
  }[size];

  // Human friendly labels
  const formatLabel = (v: string) => {
    switch (v) {
      case 'REAL_ANOMALY': return 'Anomalía Real';
      case 'DATA_QUALITY': return 'Calidad Datos';
      case 'EXPLAINABLE_ANOMALY': return 'Explicable';
      case 'FALSE_POSITIVE': return 'Falso Positivo';
      case 'CRITICAL': return 'Crítico';
      case 'ALERT': return 'Alerta';
      case 'OK': return 'Nominal';
      case 'ONLINE': return 'En Línea';
      case 'CONNECTED': return 'Conectado';
      case 'OPEN': return 'Abierta';
      case 'ACKNOWLEDGED': return 'En Revisión';
      case 'RESOLVED': return 'Resuelta';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return v;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono tracking-tight transition-colors ${styles} ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {formatLabel(val)}
    </span>
  );
};
