import React from 'react';

interface BadgeProps {
  variant?: 'status' | 'severity' | 'type';
  value: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'status', value, size = 'md', className = '' }) => {
  const val = (value || '').toUpperCase();

  let styles = 'bg-bia-navy-800 text-slate-300 border-bia-navy-700';

  if (variant === 'status') {
    switch (val) {
      case 'OK':
      case 'RESOLVED':
        styles = 'bg-bia-turquoise/15 text-bia-turquoise border-bia-turquoise/30';
        break;
      case 'ALERT':
      case 'ACKNOWLEDGED':
        styles = 'bg-bia-amber/15 text-bia-amber border-bia-amber/30';
        break;
      case 'CRITICAL':
      case 'OPEN':
        styles = 'bg-bia-coral/15 text-bia-coral border-bia-coral/30';
        break;
      default:
        styles = 'bg-bia-navy-800 text-slate-400 border-bia-navy-700';
    }
  } else if (variant === 'severity') {
    switch (val) {
      case 'HIGH':
        styles = 'bg-bia-coral/15 text-bia-coral border-bia-coral/30 font-semibold';
        break;
      case 'MEDIUM':
        styles = 'bg-bia-amber/15 text-bia-amber border-bia-amber/30 font-medium';
        break;
      case 'LOW':
        styles = 'bg-bia-turquoise/15 text-bia-turquoise border-bia-turquoise/30';
        break;
      default:
        styles = 'bg-bia-navy-800 text-slate-400 border-bia-navy-700';
    }
  } else if (variant === 'type') {
    switch (val) {
      case 'REAL_ANOMALY':
        styles = 'bg-bia-coral/15 text-bia-coral border-bia-coral/30 font-semibold';
        break;
      case 'DATA_QUALITY':
        styles = 'bg-bia-purple/15 text-bia-purple border-bia-purple/30 font-medium';
        break;
      case 'EXPLAINABLE_ANOMALY':
        styles = 'bg-sky-500/15 text-sky-300 border-sky-500/30 font-medium';
        break;
      case 'FALSE_POSITIVE':
        styles = 'bg-bia-navy-800 text-slate-400 border-bia-navy-700 font-medium';
        break;
      default:
        styles = 'bg-bia-navy-800 text-slate-300 border-bia-navy-700';
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
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono tracking-tight transition-colors ${styles} ${sizeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {formatLabel(val)}
    </span>
  );
};
