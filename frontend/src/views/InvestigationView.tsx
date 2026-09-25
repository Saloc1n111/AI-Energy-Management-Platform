import React, { useState, useEffect } from 'react';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { TremorCallout } from '../components/tremor/TremorCallout';
import { TremorDeltaBadge } from '../components/tremor/TremorDeltaBadge';
import {
  ArrowLeft,
  ShieldAlert,
  FileText,
  Calendar,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
  Send,
  Bot,
} from 'lucide-react';

interface InvestigationViewProps {
  anomalyId: string;
  onBack: () => void;
  onNavigateToMeter: (meterId: string) => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  anomalyId,
  onBack,
  onNavigateToMeter,
}) => {
  const [anomaly, setAnomaly] = useState<AnomalyDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

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

  const handleDispatch = () => {
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 3500);
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-12 text-center text-xs text-slate-400">
        Cargando expediente de telemetría e investigación Bia...
      </div>
    );
  }

  if (!anomaly) {
    return (
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-8 text-center text-xs text-bia-coral">
        Anomalía no encontrada en el sistema.
      </div>
    );
  }

  const isCritical = anomaly.severity === 'HIGH';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bia-navy-850 border border-bia-navy-750 text-xs font-semibold text-slate-300 hover:text-white hover:border-bia-turquoise/40 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Registro de Anomalías</span>
        </button>

        <button
          onClick={() => onNavigateToMeter(anomaly.meter_id)}
          className="px-3 py-1.5 rounded-lg bg-bia-navy-850 border border-bia-navy-750 text-xs font-semibold text-bia-turquoise hover:border-bia-turquoise/60 transition-colors"
        >
          Ver Telemetría Completa Medidor {anomaly.meter_id} →
        </button>
      </div>

      {/* Hero Card: Investigation Room Header */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-bia-navy-950 text-bia-turquoise border border-bia-turquoise/30">
                Score Prioridad: {anomaly.priority_score}
              </span>
              <Badge variant="type" value={anomaly.type} size="md" />
              <Badge variant="severity" value={anomaly.severity} size="md" />
              <Badge variant="status" value={anomaly.status} size="md" />
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-bia-turquoise" />
                Explicado por: <strong className="text-slate-200">{anomaly.explained_by}</strong>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-bia-coral shrink-0" />
              <span>Expediente de Decisión Operativa · Medidor {anomaly.meter_id}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal bg-bia-navy-950 p-4 rounded-lg border border-bia-navy-750">
              {anomaly.reason}
            </p>
          </div>

          {/* Operator Action Decision Box */}
          <div className="rounded-xl border border-bia-navy-750 bg-bia-navy-950 p-4 space-y-3 shrink-0 lg:w-72 shadow-sm">
            <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              Acción Operativa
            </p>

            <div className="space-y-2">
              {anomaly.status === 'OPEN' && (
                <button
                  onClick={() => handleUpdateStatus('ACKNOWLEDGED')}
                  className="w-full py-2 px-3 rounded-lg bg-bia-navy-900 hover:bg-bia-navy-850 text-bia-amber border border-bia-amber/30 font-bold text-xs tracking-tight transition-all"
                >
                  Reconocer Anomalía
                </button>
              )}

              {anomaly.status !== 'RESOLVED' ? (
                <button
                  onClick={() => handleUpdateStatus('RESOLVED')}
                  className="w-full py-2 px-3 rounded-lg bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 font-bold text-xs tracking-tight transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-bia-turquoise/25"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Marcar como Resuelta</span>
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateStatus('OPEN')}
                  className="w-full py-2 px-3 rounded-lg bg-bia-navy-900 hover:bg-bia-navy-850 text-slate-300 border border-bia-navy-750 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reabrir Incidencia</span>
                </button>
              )}

              <button
                onClick={handleDispatch}
                className="w-full py-1.5 px-3 rounded-lg bg-bia-navy-900 hover:bg-bia-navy-850 text-slate-300 border border-bia-navy-750 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Send className="w-3 h-3 text-bia-turquoise" />
                <span>Despachar Orden Técnica</span>
              </button>
            </div>

            {actionSuccess && (
              <p className="text-[11px] text-bia-turquoise font-bold text-center font-mono animate-in fade-in">
                ✓ {actionSuccess}
              </p>
            )}

            {dispatchSuccess && (
              <p className="text-[11px] text-bia-turquoise font-bold text-center font-mono animate-in fade-in">
                ✓ Orden técnica despachada al equipo de campo Bia
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recommended Action Callout */}
      <TremorCallout
        title="Acción Correctiva Sugerida"
        color={isCritical ? 'rose' : 'cyan'}
      >
        <span className="text-xs sm:text-sm font-semibold text-white">
          {anomaly.recommended_action}
        </span>
      </TremorCallout>

      {/* Grid: Quantitative Evidence & Confidence Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quantitative Evidence Table (2 cols) */}
        <div className="lg:col-span-2 rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-3.5 shadow-sm">
          <div className="pb-2 border-b border-bia-navy-750">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <FileText className="w-3.5 h-3.5 text-bia-turquoise" />
              <span>Evidencia Cuantitativa Contrastada contra Baseline</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Desviaciones matemáticas y físicas evaluadas respecto al perfil de 7 días.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bia-navy-950 text-slate-400 uppercase tracking-wider text-[10px] font-mono">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Métrica Física</th>
                  <th className="py-2.5 px-3 font-semibold">Baseline</th>
                  <th className="py-2.5 px-3 font-semibold">Observado</th>
                  <th className="py-2.5 px-3 font-semibold">Desviación</th>
                  <th className="py-2.5 px-3 font-semibold">Nota Técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bia-navy-750 font-mono">
                {anomaly.evidence?.map((e, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-bia-navy-800">
                      <td className="py-2.5 px-3 font-semibold text-white capitalize font-sans">
                        {e.metric.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {e.baseline.toFixed(1)} {e.unit}
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">
                        {e.observed.toFixed(1)} {e.unit}
                      </td>
                      <td className="py-2.5 px-3">
                        <TremorDeltaBadge
                          value={e.deviation_pct}
                          isSeverityCritical={Math.abs(e.deviation_pct) > 20}
                          size="sm"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                        {e.note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Operational Event Callout */}
          <div className="mt-3 p-3.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-bia-turquoise shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px] font-mono">
                Cruce con Eventos Operativos de Planta:
              </span>
              {anomaly.related_event ? (
                <div className="mt-1 space-y-0.5 font-mono">
                  <p className="font-bold text-bia-amber">
                    {anomaly.related_event.type}: {anomaly.related_event.description}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Fecha registrada: {new Date(anomaly.related_event.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-slate-300 font-normal">
                  Ningún evento operativo programado coincide con esta ventana. Esto confirma que la variación <strong>no responde a una parada programada ni a un cambio planificado</strong>.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Confidence Breakdown & Checklist (1 col) */}
        <div className="space-y-4">
          <ConfidenceMeter
            confidence={anomaly.confidence}
            label={anomaly.confidence_label}
            factors={anomaly.confidence_factors}
          />

          {/* Recommended Action & Investigation Steps */}
          <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              <ClipboardList className="w-3.5 h-3.5 text-bia-turquoise" />
              <span>Protocolo de Investigación Sugerido</span>
            </div>

            <div className="space-y-2">
              {anomaly.investigation_steps?.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750 text-xs text-slate-300 font-normal"
                >
                  <span className="font-mono text-bia-turquoise font-bold shrink-0">{idx + 1}.</span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
