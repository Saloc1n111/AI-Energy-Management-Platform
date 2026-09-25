import React from 'react';
import { Activity, ShieldCheck, ArrowRight, UserCheck, Zap } from 'lucide-react';

interface LoginViewProps {
  onLogin: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bia-navy-950 font-sans selection:bg-bia-turquoise/20 selection:text-bia-turquoise">
      <div className="w-full max-w-md rounded-2xl bg-bia-navy-900 border border-bia-navy-750 p-8 shadow-2xl space-y-6">
        {/* Brand */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bia-turquoise text-bia-navy-950 font-black shadow-md shadow-bia-turquoise/20">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-white font-sans lowercase">
                bia<span className="text-bia-turquoise">.</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-bia-turquoise uppercase px-1.5 py-0.5 rounded bg-bia-turquoise/10 border border-bia-turquoise/25">
                ENERGY
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Energía Inteligente para Empresas · Colombia
            </p>
          </div>
        </div>

        {/* Persona Card */}
        <div className="p-4 rounded-xl bg-bia-navy-950 border border-bia-navy-750 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-bia-turquoise flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              Operador Asignado
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bia-navy-900 text-bia-turquoise border border-bia-navy-750">
              Sesión Activa
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-bia-navy-800 border border-bia-turquoise/40 flex items-center justify-center font-mono font-bold text-xs text-bia-turquoise">
              EM
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100 leading-tight">Ing. Elena Morales</p>
              <p className="text-[11px] text-slate-400">Analista Senior de Energía · Planta Norte</p>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-bia-navy-900 p-2.5 rounded-lg border border-bia-navy-750 leading-relaxed font-mono">
            Acceso con credenciales de evaluación técnica: Supervisión de 12 medidores inteligentes, corrida de inferencia y triage operativo.
          </div>
        </div>

        {/* Login CTA */}
        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 font-bold text-xs tracking-tight shadow-md shadow-bia-turquoise/20 transition-all active:scale-95"
          >
            <span>Ingresar a la Plataforma</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-bia-turquoise" />
            <span>API Go activa en localhost:8080</span>
          </div>
        </div>
      </div>
    </div>
  );
};
