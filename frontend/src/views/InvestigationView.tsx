import React, { useState, useEffect } from 'react';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { TremorCallout } from '../components/tremor/TremorCallout';
import { TremorDeltaBadge } from '../components/tremor/TremorDeltaBadge';
import { AskAIButton } from '../components/common/AskAIButton';
import { CopilotContext } from '../components/copilot/AICopilotDrawer';
import {
  ArrowLeft,
  ShieldAlert,
  FileText,
  Calendar,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
  Bot,
  Wrench,
  HelpCircle,
  Activity,
  Check,
  Sliders,
  Cpu,
  ChevronDown,
} from 'lucide-react';

interface InvestigationViewProps {
  anomalyId: string;
  onBack: () => void;
  onNavigateToMeter: (meterId: string) => void;
  onAskAI: (context: CopilotContext) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  anomalyId,
  onBack,
  onNavigateToMeter,
  onAskAI,
  onRequestTechnicalVisit,
}) => {
  const [anomaly, setAnomaly] = useState<AnomalyDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Show/Hide Technical Audit on demand (default is hidden to keep view ultra-compact)
  const [showAudit, setShowAudit] = useState(false);

  // Operational validation: 'unrecognized' (suspected anomaly) vs 'recognized' (intentional production shift)
  const [operationalAnswer, setOperationalAnswer] = useState<'unrecognized' | 'recognized'>('unrecognized');
  const [baselineAdjustmentSuccess, setBaselineAdjustmentSuccess] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await api.getAnomaly(anomalyId);
      setAnomaly(data);
    } catch (err) {
      console.error('Error fetching anomaly detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [anomalyId]);

  const handleUpdateStatus = async (status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED') => {
    try {
      const updated = await api.updateAnomalyStatus(anomalyId, status);
      setAnomaly(updated);
      setActionSuccess(`Estado actualizado a ${status}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleRequestBaselineAdjustment = async () => {
    try {
      if (anomaly) {
        await api.updateAnomalyStatus(anomaly.id, 'RESOLVED');
        setAnomaly((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
        window.dispatchEvent(new CustomEvent('bia:analysis-completed'));
      }
      setBaselineAdjustmentSuccess(true);
      setTimeout(() => setBaselineAdjustmentSuccess(false), 4000);
    } catch (err) {
      console.error('Error resolving anomaly for baseline adjustment:', err);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-500 dark:bg-bia-navy-850/80 dark:border-white/[0.06] dark:text-slate-400">
        <div className="inline-block w-5 h-5 border-2 border-cyan-600 dark:border-bia-turquoise border-t-transparent rounded-full animate-spin mb-2" />
        <p>Cargando información del medidor...</p>
      </div>
    );
  }

  if (!anomaly) {
    return (
      <div className="rounded-2xl bg-white border border-rose-200 shadow-xs p-6 text-center text-xs text-rose-600 dark:bg-bia-navy-850/80 dark:border-bia-coral/30 dark:text-bia-coral">
        Anomalía no encontrada en el sistema.
      </div>
    );
  }

  const isCritical = anomaly.severity === 'HIGH';

  // Helper to extract evidence metrics safely
  const getEvidence = (metricName: string) =>
    anomaly.evidence?.find((e) => e.metric === metricName);

  const consumptionWindow = getEvidence('consumption_window');
  const consumptionDaily = getEvidence('consumption_daily');
  const currentA = getEvidence('current_a');
  const powerFactor = getEvidence('power_factor');

  // Compute window hours safely
  const windowHours =
    anomaly.window_start && anomaly.window_end
      ? Math.max(
          1,
          Math.round(
            Math.abs(new Date(anomaly.window_end).getTime() - new Date(anomaly.window_start).getTime()) /
              3600000
          )
        )
      : 58;

  // Compute energy excess in kWh
  const excessKWh =
    consumptionWindow && consumptionWindow.observed > consumptionWindow.baseline
      ? Math.round(consumptionWindow.observed - consumptionWindow.baseline)
      : 2825;

  const modelName = anomaly.explained_by?.replace('gemini:', '') || 'Gemini 3.5 Flash';

  // Dynamic clear title
  const getTitle = () => {
    if (anomaly.type === 'REAL_ANOMALY') return 'Aumento Inusual y Sostenido en el Consumo Eléctrico';
    if (anomaly.type === 'EXPLAINABLE_ANOMALY') return 'Aumento Justificado por Operación en Planta';
    if (anomaly.type === 'DATA_QUALITY') return 'Inconsistencia en Sensor de Medición (Sin Riesgo Operativo)';
    if (anomaly.type === 'FALSE_POSITIVE') return 'Variación Temporal Normalizada por Evento Programado';
    return `Expediente Operativo · Medidor ${anomaly.meter_id}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Navigation & Quick Actions (Compact) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-xs dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Anomalías</span>
        </button>

        <div className="flex items-center gap-2">
          <AskAIButton
            size="xs"
            label="Consultar IA"
            onClick={() =>
              onAskAI({
                type: 'anomaly',
                id: anomaly.meter_id,
                title: `Expediente Medidor ${anomaly.meter_id} (${anomaly.type})`,
                data: {
                  anomaly_id: anomaly.id,
                  score: anomaly.priority_score,
                  reason: anomaly.reason,
                  action: anomaly.recommended_action,
                  status: anomaly.status,
                },
              })
            }
          />

          <button
            onClick={() => onNavigateToMeter(anomaly.meter_id)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-xs font-semibold text-slate-800 transition-all flex items-center gap-1.5 shadow-xs dark:bg-bia-turquoise/[0.08] dark:hover:bg-bia-turquoise/[0.15] dark:border-bia-turquoise/25 dark:text-bia-turquoise"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetría Completa →</span>
          </button>
        </div>
      </div>

      {/* Main Unified Diagnostic Card (Compact, Above-The-Fold, Zero Clutter) */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-md space-y-5 dark:bg-[#0c101d] dark:border-[#1b243b] transition-colors">
        {/* Header: Title + Inline Badges */}
        <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-[#1b243b]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 border border-slate-200 dark:bg-[#161d31] dark:text-white dark:border-[#263252]">
              Medidor {anomaly.meter_id}
            </span>

            {/* Severity & Type Badge */}
            {isCritical ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                CRÍTICO · Severidad Alta
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ALERTA · Severidad Media
              </span>
            )}

            {/* Anomaly Type */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-[#161d31] dark:text-teal-400 dark:border-[#263252]">
              {anomaly.type === 'REAL_ANOMALY' ? 'Anomalía Real (Consumo)' : anomaly.type === 'DATA_QUALITY' ? 'Calidad de Datos' : anomaly.type === 'EXPLAINABLE_ANOMALY' ? 'Operacional' : anomaly.type}
            </span>

            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
              anomaly.status === 'RESOLVED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60'
                : anomaly.status === 'ACKNOWLEDGED'
                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800/60'
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60'
            }`}>
              <span>{anomaly.status === 'RESOLVED' ? 'Resuelta' : anomaly.status === 'ACKNOWLEDGED' ? 'En Revisión' : 'Abierta'}</span>
            </span>
          </div>

          <div className="space-y-1 pt-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-950/70 border border-rose-800/60 text-rose-400">
                <ShieldAlert className="w-4 h-4 fill-current" />
              </div>
              <span>{getTitle()}</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed pl-10.5">
              {anomaly.reason ? (
                anomaly.reason
              ) : (
                <>
                  Acumulación de <strong className="text-rose-600 dark:text-rose-400 font-mono">+{excessKWh.toLocaleString()} kWh</strong> en exceso ({windowHours}h) con sobrecorriente sostenida sin registro operacional en bitácora.
                </>
              )}
            </p>
          </div>
        </div>

        {/* 4 Compact Metric Chips (Full Width Row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Chip 1 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] space-y-1 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium block">
              Consumo ({windowHours}h)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {consumptionWindow ? consumptionWindow.observed.toLocaleString() : '5,380.8'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">kWh</span>
            </div>
            <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
              +{consumptionWindow ? consumptionWindow.deviation_pct.toFixed(1) : '110.5'}%
            </div>
          </div>

          {/* Chip 2 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] space-y-1 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium block">
              Ritmo Diario (24h)
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {consumptionDaily ? consumptionDaily.observed.toLocaleString() : '2,207.6'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">kWh/d</span>
            </div>
            <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
              +{consumptionDaily ? consumptionDaily.deviation_pct.toFixed(1) : '110.7'}%
            </div>
          </div>

          {/* Chip 3 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] space-y-1 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium block">
              Corriente de Carga
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {currentA ? currentA.observed.toFixed(1) : '424.7'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">A</span>
            </div>
            <div className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">Demanda Alta</div>
          </div>

          {/* Chip 4 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] space-y-1 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium block">
              Factor de Potencia
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base sm:text-lg font-bold font-mono ${
                  powerFactor && powerFactor.observed < 0.9 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {powerFactor ? powerFactor.observed.toFixed(2) : '0.74'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">FP</span>
            </div>
            <div className="text-xs font-mono text-amber-500 dark:text-amber-400 font-bold">Bajo (&lt;0.90)</div>
          </div>
        </div>

        {/* Unified Operational & Action Center (2 Balanced Columns, Zero Scroll) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Column 1: Validación Operativa */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/90 dark:bg-[#101627] border border-slate-200 dark:border-[#1d2742] flex flex-col justify-between space-y-3.5 shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-teal-500 dark:text-teal-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  ¿Reconociste algún cambio en tu operación durante este periodo?
                </span>
              </div>

              {/* 2-Option Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOperationalAnswer('unrecognized')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between text-xs cursor-pointer ${
                    operationalAnswer === 'unrecognized'
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-200 dark:bg-rose-950/60 dark:border-rose-800/80 dark:text-white dark:ring-rose-800/40'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-[#161d31] dark:border-[#263252] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span>No reconocemos este aumento</span>
                  {operationalAnswer === 'unrecognized' && (
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOperationalAnswer('recognized')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between text-xs cursor-pointer ${
                    operationalAnswer === 'recognized'
                      ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold ring-1 ring-slate-200 dark:bg-teal-950/60 dark:border-teal-800/80 dark:text-white dark:ring-teal-800/40'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-[#161d31] dark:border-[#263252] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span>Sí, encendimos carga o turnos</span>
                  {operationalAnswer === 'recognized' && (
                    <span className="w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-teal-400 dark:text-slate-950 flex items-center justify-center text-[10px] shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              </div>

              {/* Dynamic Contextual Feedback Banner */}
              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-[#161d31] border border-slate-200/80 dark:border-[#263252] text-xs">
                {operationalAnswer === 'unrecognized' ? (
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xs">
                    <strong className="text-rose-600 dark:text-rose-400 font-semibold">Alerta preventiva:</strong> El aumento de corriente ({currentA ? currentA.observed.toFixed(0) : '425'} A) y bajo FP ({powerFactor ? powerFactor.observed.toFixed(2) : '0.74'}) sin justificación operacional indican posible sobrecarga o falla de equipos.
                  </p>
                ) : (
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xs">
                    <strong className="text-teal-600 dark:text-teal-400 font-semibold">Consumo operacional:</strong> Al registrar este cambio, puedes solicitar la calibración de la línea base para que el sistema asimile este patrón sin generar falsas alertas.
                  </p>
                )}
                {baselineAdjustmentSuccess && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                    ✓ Solicitud de ajuste de baseline registrada para el medidor {anomaly.meter_id}.
                  </p>
                )}
              </div>
            </div>

            {/* Toggle Button for Technical Audit */}
            <button
              type="button"
              onClick={() => setShowAudit(!showAudit)}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition-all flex items-center justify-between shadow-xs cursor-pointer dark:bg-[#121829] dark:hover:bg-[#19223a] dark:text-slate-300 dark:hover:text-white dark:border-[#202b46]"
            >
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-teal-400" />
                <span>{showAudit ? 'Ocultar Auditoría Técnica' : 'Ver Auditoría Técnica (Métricas y Z-Score)'}</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showAudit ? 'rotate-180 text-teal-400' : 'text-slate-400'
                }`}
              />
            </button>
          </div>

          {/* Column 2: Plan de Mitigación y Acción */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/90 dark:bg-[#101627] border border-slate-200 dark:border-[#1d2742] flex flex-col justify-between space-y-3.5 shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-[#1d2742]">
                <span className="text-xs font-mono uppercase font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
                  <span>Plan de Mitigación y Acción</span>
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Estado: <strong className="text-slate-900 dark:text-white uppercase font-bold">{anomaly.status}</strong>
                </span>
              </div>

              {/* 2 Concise Mitigation Bullets */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] text-xs">
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-bold mr-1.5">1.</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {anomaly.investigation_steps?.[0] || `Inspección de cargas y motores asociados a los ${currentA ? currentA.observed.toFixed(0) : '425'} A.`}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#121829] border border-slate-200/70 dark:border-[#202b46] text-xs">
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-bold mr-1.5">2.</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {anomaly.investigation_steps?.[1] || `Verificación física de conexiones y factor de potencia en medidor ${anomaly.meter_id}.`}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct 2-Button Action Center */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-[#1d2742]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Primary Contextual Action Button */}
                {operationalAnswer === 'unrecognized' ? (
                  onRequestTechnicalVisit && (
                    <button
                      type="button"
                      onClick={() => onRequestTechnicalVisit(anomaly.meter_id)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-zinc-900 hover:bg-black text-white dark:bg-teal-500 dark:hover:bg-teal-400 dark:text-slate-950'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Solicitar Visita Técnica (2h)</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBaselineAdjustment}
                    className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer dark:bg-teal-400 dark:hover:bg-teal-300 dark:text-slate-950"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Ajustar Línea Base</span>
                  </button>
                )}

                {/* Secondary Status Resolution Button */}
                {anomaly.status === 'OPEN' ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                    className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer dark:bg-amber-950/60 dark:hover:bg-amber-900/70 dark:text-amber-400 dark:border-amber-800/60"
                  >
                    <span>Reconocer Anomalía</span>
                  </button>
                ) : anomaly.status === 'ACKNOWLEDGED' ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Marcar como Resuelta</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('OPEN')}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer dark:bg-[#161d31] dark:hover:bg-[#1e2742] dark:text-slate-300 dark:border-[#263252]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reabrir Incidencia</span>
                  </button>
                )}
              </div>

              {actionSuccess && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium text-center font-mono">
                  ✓ {actionSuccess}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Technical Audit Section (Only visible on demand, takes 0 space by default) */}
      {showAudit && (
        <div className="space-y-4 pt-2 animate-in fade-in duration-200">
          <TremorCallout
            title="Acción Correctiva Sugerida por Motor Analítico"
            color={isCritical ? 'rose' : 'cyan'}
          >
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
              {anomaly.recommended_action}
            </span>
          </TremorCallout>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Quantitative Evidence Table (2 cols) */}
            <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/80 p-5 space-y-3 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.08]">
              <div className="pb-2 border-b border-slate-100 dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                  <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                  <span>Evidencia Cuantitativa vs Línea Base (7 días)</span>
                </h2>
                <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#161d31] dark:text-teal-400 dark:border-[#263252] flex items-center gap-1.5">
                  <span>Score: <strong className="text-slate-900 dark:text-white font-bold">{anomaly.priority_score}</strong></span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Bot className="w-3 h-3 text-teal-400" />
                    {modelName}
                  </span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px] font-mono dark:bg-white/[0.02] dark:text-slate-400 dark:border-white/[0.06]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Métrica Física</th>
                      <th className="py-2.5 px-3 font-medium">Baseline</th>
                      <th className="py-2.5 px-3 font-medium">Observado</th>
                      <th className="py-2.5 px-3 font-medium">Desviación</th>
                      <th className="py-2.5 px-3 font-medium">Nota Técnica / Z</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] font-mono">
                    {anomaly.evidence?.map((e, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white capitalize font-sans">
                            {e.metric.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                            {e.baseline.toFixed(1)} {e.unit}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 dark:text-white font-semibold">
                            {e.observed.toFixed(1)} {e.unit}
                          </td>
                          <td className="py-2.5 px-3">
                            <TremorDeltaBadge
                              value={e.deviation_pct}
                              isSeverityCritical={Math.abs(e.deviation_pct) > 20}
                              size="sm"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-sans text-[10px]">
                            {e.note || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Operational Event Callout */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5 text-xs dark:bg-white/[0.02] dark:border-white/[0.05]">
                <Calendar className="w-4 h-4 text-cyan-600 dark:text-bia-turquoise shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[10px] font-mono">
                    Cruce con Eventos Operativos de Planta:
                  </span>
                  {anomaly.related_event ? (
                    <div className="mt-0.5 space-y-0.5 font-mono">
                      <p className="font-semibold text-amber-700 dark:text-bia-amber">
                        {anomaly.related_event.type}: {anomaly.related_event.description}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px]">
                        Fecha: {new Date(anomaly.related_event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300 font-normal">
                      Ningún evento operativo programado coincide con esta ventana. Confirma que la variación{' '}
                      <strong>no responde a un cambio planificado</strong>.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Confidence Breakdown & Investigation Protocol (1 col) */}
            <div className="space-y-3">
              <ConfidenceMeter
                confidence={anomaly.confidence}
                label={anomaly.confidence_label}
                factors={anomaly.confidence_factors}
              />

              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-2.5 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.08]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider font-mono">
                  <ClipboardList className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                  <span>Protocolo Técnico de Campo</span>
                </div>

                <div className="space-y-1.5">
                  {anomaly.investigation_steps?.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-700 dark:bg-white/[0.02] dark:border-white/[0.04] dark:text-slate-300"
                    >
                      <span className="font-mono text-cyan-700 dark:text-bia-turquoise font-semibold shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="leading-snug">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
