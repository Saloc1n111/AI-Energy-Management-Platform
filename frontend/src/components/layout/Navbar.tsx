import React from 'react';
import { Activity, Play, Zap } from 'lucide-react';

interface NavbarProps {
  onRunAnalysis: () => void;
  isAnalyzing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onRunAnalysis, isAnalyzing = false }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-bia-navy-900/95 backdrop-blur-md border-b border-bia-navy-750 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Brand: Bia Energy */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bia-turquoise text-bia-navy-950 font-black shadow-sm shadow-bia-turquoise/20">
          <Zap className="w-4 h-4 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-white font-sans lowercase">
              bia<span className="text-bia-turquoise">.</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-bia-turquoise uppercase px-1.5 py-0.5 rounded bg-bia-turquoise/10 border border-bia-turquoise/25">
              ENERGY
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-normal">
            Energía Inteligente para Empresas · Telemetría en Tiempo Real
          </p>
        </div>
      </div>

      {/* Center / Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Bia Primary Action Button (Signature Bright Turquoise) */}
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-normal transition-all ${
            isAnalyzing
              ? 'bg-bia-navy-800 text-slate-400 cursor-not-allowed border border-bia-navy-700'
              : 'bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 active:scale-95 shadow-sm shadow-bia-turquoise/25'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Activity className="w-3.5 h-3.5 animate-spin text-bia-turquoise" />
              <span>Ejecutando Diagnóstico...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Ejecutar Diagnóstico</span>
            </>
          )}
        </button>

        {/* Live Backend Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-bia-navy-950 border border-bia-navy-750 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-bia-turquoise shadow-sm shadow-bia-turquoise/50" />
          <span className="text-slate-400 text-[11px]">API: 8080 Conectado</span>
        </div>

        {/* Operator Profile */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-bia-navy-750">
          <div className="w-7 h-7 rounded-full bg-bia-navy-800 border border-bia-turquoise/40 flex items-center justify-center text-[11px] font-bold text-bia-turquoise">
            EM
          </div>
          <div className="hidden lg:block text-left text-xs">
            <p className="font-semibold text-slate-100 leading-tight">Ing. Elena Morales</p>
            <p className="text-[10px] text-slate-400">Analista Senior de Energía</p>
          </div>
        </div>
      </div>
    </header>
  );
};
