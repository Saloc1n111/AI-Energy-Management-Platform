import React, { useState, useEffect } from 'react';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface AnomaliesViewProps {
  onInvestigate: (anomalyId: string) => void;
  onSelectMeter: (meterId: string) => void;
}

export const AnomaliesView: React.FC<AnomaliesViewProps> = ({
  onInvestigate,
  onSelectMeter,
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
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-bia-amber" />
            Registro de Anomalías e Incidencias (Priorizadas)
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Clasificación y ordenamiento estricto por severidad, tipo de hallazgo y score de prioridad.
          </p>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-bia-navy-850 border border-bia-navy-750 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <Filter className="w-3.5 h-3.5 text-bia-turquoise" />
            <span>Filtros:</span>
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-bia-navy-950 border border-bia-navy-750 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-bia-turquoise font-sans"
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
            className="bg-bia-navy-950 border border-bia-navy-750 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-bia-turquoise font-sans"
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
            className="bg-bia-navy-950 border border-bia-navy-750 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-bia-turquoise font-sans"
          >
            <option value="">Todos los Estados</option>
            <option value="OPEN">Abierta (OPEN)</option>
            <option value="ACKNOWLEDGED">En Revisión (ACKNOWLEDGED)</option>
            <option value="RESOLVED">Resuelta (RESOLVED)</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px]">
          Mostrando {anomalies.length} incidencias
        </span>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-bia-navy-850 border border-bia-navy-750 p-12 text-center text-xs text-slate-400 rounded-xl">
            Cargando incidencias del backend...
          </div>
        ) : anomalies.length === 0 ? (
          <div className="bg-bia-navy-850 border border-bia-navy-750 p-12 text-center text-xs text-slate-400 rounded-xl">
            No hay anomalías que coincidan con los filtros seleccionados.
          </div>
        ) : (
          anomalies.map((a, index) => {
            const isTop = index === 0;

            return (
              <div
                key={a.id}
                onClick={() => onInvestigate(a.id)}
                className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer group ${
                  isTop
                    ? 'bg-bia-navy-850 border-bia-coral/40 hover:border-bia-coral hover:bg-bia-navy-800'
                    : 'bg-bia-navy-850 border-bia-navy-750 hover:border-bia-turquoise/40 hover:bg-bia-navy-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Meter, Badges, Reason */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-bia-navy-950 text-slate-400 border border-bia-navy-750">
                        #{index + 1} (Score: {a.priority_score})
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMeter(a.meter_id);
                        }}
                        className="text-sm font-bold text-white font-mono hover:text-bia-turquoise transition-colors flex items-center gap-1.5"
                      >
                        <span>Medidor {a.meter_id}</span>
                      </button>

                      <Badge variant="type" value={a.type} size="sm" />
                      <Badge variant="severity" value={a.severity} size="sm" />
                      <Badge variant="status" value={a.status} size="sm" />
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {a.reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                      <span>
                        Acción: <strong className="text-slate-200 font-semibold">{a.recommended_action}</strong>
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        Certeza: <strong className="text-bia-turquoise">{Math.round(a.confidence * 100)}%</strong>
                      </span>
                      {a.related_event && (
                        <>
                          <span>·</span>
                          <span className="text-bia-amber font-mono text-[11px]">
                            Evento: {a.related_event.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="shrink-0 flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-bia-navy-750">
                    {/* Status Toggle Quick Buttons */}
                    {a.status === 'OPEN' && (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'ACKNOWLEDGED')}
                        className="px-2.5 py-1.5 rounded-lg bg-bia-navy-950 hover:bg-bia-navy-800 text-bia-amber border border-bia-amber/30 text-xs font-semibold transition-colors"
                      >
                        Reconocer
                      </button>
                    )}

                    {a.status !== 'RESOLVED' ? (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'RESOLVED')}
                        className="px-2.5 py-1.5 rounded-lg bg-bia-navy-950 hover:bg-bia-navy-800 text-bia-turquoise border border-bia-turquoise/30 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolver</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleStatusChange(e, a.id, 'OPEN')}
                        className="px-2.5 py-1.5 rounded-lg bg-bia-navy-950 hover:bg-bia-navy-800 text-slate-400 border border-bia-navy-750 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reabrir</span>
                      </button>
                    )}

                    {/* Investigate Full Button */}
                    <button
                      onClick={() => onInvestigate(a.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-bia-turquoise/25 transition-all active:scale-95"
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
