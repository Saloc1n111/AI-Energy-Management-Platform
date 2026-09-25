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
    <div className={`rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-bia-turquoise" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Certeza del Diagnóstico
          </h4>
        </div>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-xl font-bold text-white">
            {percentage}%
          </span>
          {label && (
            <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-bia-navy-950 text-bia-turquoise border border-bia-turquoise/30">
              {label}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-bia-navy-950 rounded-full h-2 overflow-hidden border border-bia-navy-750">
        <div
          className="h-full bg-bia-turquoise rounded-full transition-all duration-500 shadow-sm shadow-bia-turquoise"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Factor Breakdown */}
      {factors.length > 0 && (
        <div className="mt-4 pt-3 border-t border-bia-navy-750">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-2.5">
            <Info className="w-3 h-3 text-bia-turquoise" />
            <span>Factores cuantitativos que sustentan el score:</span>
          </div>

          <div className="space-y-2">
            {factors.map((f, i) => (
              <div key={i} className="flex items-start justify-between text-xs gap-3">
                <div className="flex-1">
                  <span className="font-semibold text-slate-200 capitalize">{f.name.replace(/_/g, ' ')}</span>
                  <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">{f.detail}</p>
                </div>
                <span className="font-mono text-bia-turquoise text-[11px] font-bold bg-bia-navy-950 px-1.5 py-0.5 rounded border border-bia-navy-750 shrink-0">
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
