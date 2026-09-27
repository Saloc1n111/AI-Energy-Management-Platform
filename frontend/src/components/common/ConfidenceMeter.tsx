import React from 'react';
import { FactorDTO } from '../../types/anomaly';
import { ShieldCheck, Info } from 'lucide-react';

interface ConfidenceMeterProps {
  confidence: number; // 0.0 to 1.0
  label?: string;
  factors?: FactorDTO[];
  className?: string;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  confidence,
  label,
  factors = [],
  className = '',
}) => {
  const percentage = Math.round(confidence * 100);

  return (
    <div className={`rounded-2xl bg-white border border-slate-200/80 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.06] p-5 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-bia-turquoise" />
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-700 dark:text-slate-200 font-mono">
            Certeza del Diagnóstico
          </h4>
        </div>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {percentage}%
          </span>
          {label && (
            <span className="text-[10px] uppercase font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/20">
              {label}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-bia-turquoise rounded-full transition-all duration-500 shadow-sm shadow-bia-turquoise/30"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Factor Breakdown */}
      {factors.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 mb-2.5">
            <Info className="w-3 h-3 text-bia-turquoise" />
            <span>Factores cuantitativos que sustentan el score:</span>
          </div>

          <div className="space-y-2">
            {factors.map((f, i) => (
              <div key={i} className="flex items-start justify-between text-xs gap-3">
                <div className="flex-1">
                  <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">{f.name.replace(/_/g, ' ')}</span>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">{f.detail}</p>
                </div>
                <span className="font-mono text-emerald-700 dark:text-bia-turquoise text-[11px] font-medium bg-emerald-50 dark:bg-bia-turquoise/[0.08] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-bia-turquoise/20 shrink-0">
                  +{(f.weight * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
