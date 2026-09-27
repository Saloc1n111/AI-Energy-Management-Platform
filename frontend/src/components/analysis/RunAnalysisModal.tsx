import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { RunDTO } from '../../types/analysis';
import { api } from '../../api/client';
import {
  Database,
  BarChart3,
  Search,
  Zap,
  CalendarCheck,
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface RunAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (run: RunDTO) => void;
  onNavigateToMeter?: (meterId: string) => void;
  onNavigateToAnomalies?: () => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  READINGS: <Database className="w-3.5 h-3.5" />,
  BASELINE: <BarChart3 className="w-3.5 h-3.5" />,
  DETECTION: <Search className="w-3.5 h-3.5" />,
  CORRELATION: <Zap className="w-3.5 h-3.5" />,
  EVENTS: <CalendarCheck className="w-3.5 h-3.5" />,
  EXPLANATION: <Brain className="w-3.5 h-3.5" />,
  RECOMMENDATION: <CheckCircle2 className="w-3.5 h-3.5" />,
};

export const RunAnalysisModal: React.FC<RunAnalysisModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  onNavigateToMeter,
  onNavigateToAnomalies,
}) => {
  const [run, setRun] = useState<RunDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger analysis when opened
  useEffect(() => {
    if (!isOpen) {
      setRun(null);
      setError(null);
      return;
    }

    let intervalId: any = null;
    let isCancelled = false;

    const startRun = async () => {
      setLoading(true);
      setError(null);
      try {
        const initialRun = await api.triggerAnalysis();
        if (isCancelled) return;
        setRun(initialRun);

        // Start polling
        intervalId = setInterval(async () => {
          try {
            const current = await api.getAnalysisStatus(initialRun.id);
            if (isCancelled) return;
            setRun(current);

            if (current.status === 'COMPLETED' || current.status === 'FAILED') {
              clearInterval(intervalId);
              setLoading(false);
              if (current.status === 'COMPLETED' && onComplete) {
                onComplete(current);
              }
            }
          } catch (err: any) {
            console.error('Polling error:', err);
          }
        }, 350);
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Error al iniciar el análisis');
          setLoading(false);
        }
      }
    };

    startRun();

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen]);

  const isCompleted = run?.status === 'COMPLETED';
  const isFailed = run?.status === 'FAILED' || !!error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Run AI Analysis — Pipeline de Inteligencia Artificial (7 Fases)"
      subtitle="Lecturas → Baseline → Detección → Correlación → Eventos → Explicación → Recomendación"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Progress header */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 dark:bg-white/[0.02] dark:border-white/[0.06]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-mono text-slate-500 dark:text-slate-400">
              Estado de Ejecución:
            </span>
            <span
              className={`font-mono text-xs font-semibold uppercase ${
                isCompleted
                  ? 'text-emerald-700 dark:text-bia-turquoise'
                  : isFailed
                  ? 'text-rose-600 dark:text-bia-coral'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {run?.status || (loading ? 'INICIANDO...' : 'LISTO')}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200/70 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-600 dark:bg-bia-turquoise shadow-xs'
                  : isFailed
                  ? 'bg-rose-600 dark:bg-bia-coral'
                  : 'bg-cyan-600 dark:bg-bia-turquoise'
              }`}
              style={{
                width: `${
                  run ? Math.round(run.progress * 100) : loading ? 10 : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {run?.steps?.map((step, idx) => {
            const isStepRunning = step.status === 'RUNNING';
            const isStepDone = step.status === 'COMPLETED';
            const isStepPending = step.status === 'PENDING';

            return (
              <div
                key={step.name}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isStepRunning
                    ? 'bg-cyan-50/70 border-cyan-200 shadow-xs dark:bg-bia-turquoise/[0.06] dark:border-bia-turquoise/30'
                    : isStepDone
                    ? 'bg-slate-50 border-slate-200/70 dark:bg-white/[0.02] dark:border-white/[0.05]'
                    : 'bg-transparent border-slate-100 dark:border-white/[0.03] opacity-40'
                }`}
              >
                {/* Step icon / indicator */}
                <div
                  className={`p-1.5 rounded-lg border mt-0.5 ${
                    isStepRunning
                      ? 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-white/[0.04] dark:text-bia-turquoise dark:border-bia-turquoise/30'
                      : isStepDone
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/20'
                      : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-white/[0.02] dark:text-slate-500 dark:border-white/[0.05]'
                  }`}
                >
                  {isStepRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-700 dark:text-bia-turquoise" />
                  ) : isStepDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-bia-turquoise" />
                  ) : (
                    STEP_ICONS[step.name] || <span className="text-xs font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-medium font-mono uppercase ${
                        isStepRunning ? 'text-cyan-800 dark:text-bia-turquoise' : isStepDone ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      Fase {idx + 1}: {step.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                      {step.status}
                    </span>
                  </div>

                  {step.detail ? (
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                      {step.detail}
                    </p>
                  ) : isStepRunning ? (
                    <p className="mt-0.5 text-xs text-cyan-700 dark:text-bia-turquoise/90 animate-pulse font-normal">
                      Calculando parámetros y ejecutando inferencia Bia...
                    </p>
                  ) : isStepPending ? (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">En espera de fase anterior...</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Banner when Completed */}
        {isCompleted && run && (
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3 shadow-xs dark:bg-bia-turquoise/[0.08] dark:border-bia-turquoise/35 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 dark:bg-bia-turquoise/15 dark:border-bia-turquoise/30 dark:text-bia-turquoise">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-bia-turquoise" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                  {run.message || '4 anomalías detectadas · 2 requieren atención prioritaria'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-sans mt-0.5">
                  Pipeline finalizado: Subestación M-109 priorizada como Anomalía Real Crítica (+110.7%).
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-emerald-100 dark:border-white/[0.05]">
              {onNavigateToMeter && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToMeter('M-109');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Investigar M-109</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}

              {onNavigateToAnomalies && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToAnomalies();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 shadow-xs transition-colors cursor-pointer dark:bg-white/[0.03] dark:hover:bg-bia-turquoise/[0.1] dark:text-bia-turquoise dark:border-bia-turquoise/20"
                >
                  <span>Ver las 4 Incidencias</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="ml-auto px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3 dark:bg-bia-coral/[0.08] dark:border-bia-coral/25 dark:text-bia-coral">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-bia-coral" />
            <div>
              <p className="font-semibold">Error en la ejecución:</p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{run?.error || error}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
