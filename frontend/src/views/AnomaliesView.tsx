import React, { useState, useEffect } from 'react';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { AskAIButton } from '../components/common/AskAIButton';
import { CopilotContext } from '../components/copilot/AICopilotDrawer';
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  RotateCcw,
  Wrench,
  Sparkles,
  Play,
} from 'lucide-react';

interface AnomaliesViewProps {
  onInvestigate: (anomalyId: string) => void;
  onSelectMeter: (meterId: string) => void;
  onRunAnalysis?: () => void;
  onAskAI?: (context: CopilotContext) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
}

export const AnomaliesView: React.FC<AnomaliesViewProps> = ({
  onInvestigate,
  onSelectMeter,
  onRunAnalysis,
  onAskAI,
  onRequestTechnicalVisit,
}) => {
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const resp = await api.getAnomalies({
        severity: severityFilter,
        type: typeFilter,
        status: statusFilter,
      });
      setAnomalies(resp.data);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [severityFilter, typeFilter, statusFilter]);

  const handleStatusChange = async (
    e: React.MouseEvent,
    id: string,
    newStatus: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  ) => {
    e.stopPropagation();
    try {
      await api.updateAnomalyStatus(id, newStatus);
      fetchAnomalies();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-bia-amber" />
            Registro de Anomalías e Incidencias (Priorizadas)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 font-normal">
            Clasificación y ordenamiento estricto por severidad, tipo de hallazgo y score de prioridad.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onRunAnalysis && (
            <button
              onClick={onRunAnalysis}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Ejecutar análisis de IA de 7 fases sobre los 12 medidores"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run AI Analysis</span>
            </button>
          )}

          {onAskAI && (
            <AskAIButton
              label="Consultar IA sobre Incidencias"
              size="sm"
              onClick={() =>
                onAskAI({
                  type: 'kpi',
                  id: 'anomalies_hub',
                  title: 'Centro de Anomalías e Incidencias',
                  description: 'Análisis de todas las incidencias abiertas y priorizadas en planta.',
                })
              }
            />
          )}
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs backdrop-blur-sm dark:bg-[#0c101d] dark:border-[#1b243b] transition-colors">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
            <span>Filtros:</span>
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-[#121829] border border-slate-200 dark:border-[#202b46] rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-bia-turquoise/50 font-sans transition-all shadow-xs"
          >
            <option value="">Todas las Severidades</option>
            <option value="HIGH">Severidad Alta (High)</option>
            <option value="MEDIUM">Severidad Media (Medium)</option>
            <option value="LOW">Severidad Baja (Low)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-[#121829] border border-slate-200 dark:border-[#202b46] rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-bia-turquoise/50 font-sans transition-all shadow-xs"
          >
            <option value="">Todos los Tipos</option>
            <option value="REAL_ANOMALY">Anomalía Real</option>
            <option value="DATA_QUALITY">Calidad de Datos</option>
            <option value="EXPLAINABLE_ANOMALY">Explicable (Operativa)</option>
            <option value="FALSE_POSITIVE">Falso Positivo</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-[#121829] border border-slate-200 dark:border-[#202b46] rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-bia-turquoise/50 font-sans transition-all shadow-xs"
          >
            <option value="">Todos los Estados</option>
            <option value="OPEN">Abierta (OPEN)</option>
            <option value="ACKNOWLEDGED">En Revisión (ACKNOWLEDGED)</option>
            <option value="RESOLVED">Resuelta (RESOLVED)</option>
          </select>
        </div>

        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Mostrando {anomalies.length} incidencias
        </span>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-slate-200/80 p-12 text-center text-xs text-slate-400 rounded-2xl shadow-xs dark:bg-[#0c101d] dark:border-[#1b243b]">
            Cargando incidencias del backend...
          </div>
        ) : anomalies.length === 0 ? (
          <div className="bg-white border border-slate-200/80 p-12 text-center rounded-2xl shadow-xs dark:bg-[#0c101d] dark:border-[#1b243b] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 dark:bg-[#161d31] dark:border-[#263252] flex items-center justify-center mx-auto text-slate-400">
              <AlertTriangle className="w-6 h-6 text-slate-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                No se registran anomalías en este momento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Si aún no has ejecutado el análisis de IA, haz clic en <strong>Run AI Analysis</strong> para procesar la telemetría de los 12 medidores y clasificar incidencias.
              </p>
            </div>
            {onRunAnalysis && (
              <button
                onClick={onRunAnalysis}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run AI Analysis</span>
              </button>
            )}
          </div>
        ) : (
          anomalies.map((a, index) => {
            const isTop = index === 0;

            return (
              <div
                key={a.id}
                onClick={() => onInvestigate(a.id)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group shadow-xs ${
                  isTop
                    ? 'bg-white border-rose-200/80 hover:border-rose-300 dark:bg-[#0c101d] dark:border-rose-800/60 dark:hover:border-rose-500/60'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-teal-500/40'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Meter, Badges, Reason */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 dark:bg-white/[0.03] dark:border-white/[0.06]">
                        #{index + 1} (Score: {a.priority_score})
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMeter(a.meter_id);
                        }}
                        className="text-sm font-semibold text-slate-900 dark:text-white font-mono hover:text-cyan-600 dark:hover:text-bia-turquoise transition-colors flex items-center gap-1.5"
                      >
                        <span>Medidor {a.meter_id}</span>
                      </button>

                      <Badge variant="type" value={a.type} size="sm" />
                      <Badge variant="severity" value={a.severity} size="sm" />
                      <Badge variant="status" value={a.status} size="sm" />

                      {onAskAI && (
                        <AskAIButton
                          size="xs"
                          label="Preguntar a la IA"
                          onClick={() =>
                            onAskAI({
                              type: 'anomaly',
                              id: a.meter_id,
                              title: `Incidencia en Medidor ${a.meter_id} (${a.type})`,
                              data: {
                                anomaly_id: a.id,
                                score: a.priority_score,
                                reason: a.reason,
                                action: a.recommended_action,
                              },
                            })
                          }
                        />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {a.reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                      <span>
                        Acción: <strong className="text-slate-800 dark:text-slate-200 font-medium">{a.recommended_action}</strong>
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        Certeza: <strong className="text-cyan-700 dark:text-bia-turquoise font-medium">{Math.round(a.confidence * 100)}%</strong>
                      </span>
                      {a.related_event && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 dark:text-bia-amber font-mono text-[11px]">
                            Evento: {a.related_event.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="shrink-0 flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/[0.05]">
                    {a.meter_id === 'M-109' && onRequestTechnicalVisit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestTechnicalVisit('M-109');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-bia-coral/15 dark:hover:bg-bia-coral/30 dark:text-bia-coral dark:border-bia-coral/40 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Solicitar Visita</span>
                      </button>
                    )}

                    {/* Status Toggle Quick Buttons */}
                    {a.status === 'OPEN' && (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'ACKNOWLEDGED')}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-bia-amber/[0.08] dark:hover:bg-bia-amber/[0.15] dark:text-bia-amber dark:border-bia-amber/25 text-xs font-medium transition-all shadow-xs"
                      >
                        Reconocer
                      </button>
                    )}

                    {a.status !== 'RESOLVED' ? (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'RESOLVED')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-bia-turquoise/[0.08] dark:hover:bg-bia-turquoise/[0.15] dark:text-bia-turquoise dark:border-bia-turquoise/25 text-xs font-medium transition-all flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolver</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'OPEN')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:text-slate-400 dark:border-white/[0.06] text-xs font-medium transition-all flex items-center gap-1 shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reabrir</span>
                      </button>
                    )}

                    {/* Investigate Full Button */}
                    <button
                      onClick={() => onInvestigate(a.id)}
                      className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <span>Auditar</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
