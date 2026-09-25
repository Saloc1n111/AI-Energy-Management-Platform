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
      title="Bia Energy Engine — Pipeline de Diagnóstico (7 Fases)"
      subtitle="Lecturas → Baseline → Detección → Correlación → Eventos → Explicación → Recomendación"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Progress header */}
        <div className="rounded-xl bg-bia-navy-950 border border-bia-navy-750 p-3.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-mono text-slate-400">
              Estado de Ejecución:
            </span>
            <span
              className={`font-mono text-xs font-bold uppercase ${
                isCompleted
                  ? 'text-bia-turquoise'
                  : isFailed
                  ? 'text-bia-coral'
                  : 'text-white'
              }`}
            >
              {run?.status || (loading ? 'INICIANDO...' : 'LISTO')}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-bia-navy-900 rounded-full h-1.5 overflow-hidden border border-bia-navy-750">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-bia-turquoise shadow-sm shadow-bia-turquoise'
                  : isFailed
                  ? 'bg-bia-coral'
                  : 'bg-bia-turquoise'
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
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all ${
                  isStepRunning
                    ? 'bg-bia-navy-800 border-bia-turquoise/40 shadow-sm shadow-bia-turquoise/10'
                    : isStepDone
                    ? 'bg-bia-navy-950/70 border-bia-navy-750'
                    : 'bg-bia-navy-950/30 border-bia-navy-800 opacity-60'
                }`}
              >
                {/* Step icon / indicator */}
                <div
                  className={`p-1.5 rounded-md border mt-0.5 ${
                    isStepRunning
                      ? 'bg-bia-navy-900 text-bia-turquoise border-bia-turquoise/40'
                      : isStepDone
                      ? 'bg-bia-turquoise/15 text-bia-turquoise border-bia-turquoise/30'
                      : 'bg-bia-navy-900 text-slate-500 border-bia-navy-750'
                  }`}
                >
                  {isStepRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-bia-turquoise" />
                  ) : isStepDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-bia-turquoise" />
                  ) : (
                    STEP_ICONS[step.name] || <span className="text-xs font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold font-mono uppercase ${
                        isStepRunning ? 'text-bia-turquoise' : isStepDone ? 'text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      Fase {idx + 1}: {step.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {step.status}
                    </span>
                  </div>

                  {step.detail ? (
                    <p className="mt-0.5 text-xs text-slate-300 font-normal leading-relaxed">
                      {step.detail}
                    </p>
                  ) : isStepRunning ? (
                    <p className="mt-0.5 text-xs text-bia-turquoise/90 animate-pulse font-normal">
                      Calculando parámetros y ejecutando inferencia Bia...
                    </p>
                  ) : isStepPending ? (
                    <p className="mt-0.5 text-xs text-slate-500">En espera de fase anterior...</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Banner when Completed */}
        {isCompleted && run && (
          <div className="p-3.5 rounded-xl bg-bia-navy-950 border border-bia-turquoise/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-bia-turquoise shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">
                  {run.message || 'Diagnóstico completado con éxito'}
                </p>
                <p className="text-[11px] text-slate-400 font-sans">
                  M-109 priorizado como Anomalía Real Crítica (+110.7%).
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-bia-navy-750">
              {onNavigateToMeter && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToMeter('M-109');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bia-coral hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm shadow-bia-coral/30"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bia-navy-900 hover:bg-bia-navy-800 text-bia-turquoise text-xs font-bold border border-bia-turquoise/30 transition-colors"
                >
                  <span>Ver las 4 Incidencias</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {isFailed && (
          <div className="p-3.5 rounded-xl bg-bia-coral/15 border border-bia-coral/30 text-bia-coral text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 text-bia-coral" />
            <div>
              <p className="font-bold">Error en la ejecución:</p>
              <p className="text-slate-300 mt-0.5">{run?.error || error}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
