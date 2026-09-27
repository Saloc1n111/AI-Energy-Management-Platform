import React, { useState, useEffect } from 'react';
import { MeterDTO } from '../types/meter';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { TremorDeltaBadge } from '../components/tremor/TremorDeltaBadge';
import {
  Gauge,
  Search,
  ArrowUpDown,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface MetersViewProps {
  onSelectMeter: (meterId: string) => void;
}

export const MetersView: React.FC<MetersViewProps> = ({ onSelectMeter }) => {
  const [meters, setMeters] = useState<MeterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('severity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchMeters = async () => {
    setLoading(true);
    try {
      const resp = await api.getMeters({
        status: statusFilter,
        q: searchQuery,
        sort: sortField,
        order: sortOrder,
      });
      setMeters(resp.data);
    } catch (err) {
      console.error('Error fetching meters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeters();
  }, [statusFilter, sortField, sortOrder]);

  // Real-time synchronization when AI analysis completes anywhere
  useEffect(() => {
    const handleAnalysisCompleted = () => {
      fetchMeters();
    };
    window.addEventListener('bia:analysis-completed', handleAnalysisCompleted);
    return () => {
      window.removeEventListener('bia:analysis-completed', handleAnalysisCompleted);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMeters();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const statusTabs = [
    { id: '', label: 'Todos los Medidores' },
    { id: 'OK', label: 'Nominales' },
    { id: 'ALERT', label: 'En Alerta' },
    { id: 'CRITICAL', label: 'Críticos' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-600 dark:text-bia-turquoise" />
            Parque de Medidores Inteligentes Bia
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 font-normal">
            Supervisión continua de 12 puntos de medición en tiempo real. Consumo actual frente al perfil baseline horario calibrado.
          </p>
        </div>

        {/* Quick focus for M-109 */}
        <button
          onClick={() => onSelectMeter('M-109')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-bia-coral/[0.1] dark:hover:bg-bia-coral/[0.2] dark:text-bia-coral dark:border-bia-coral/25 text-xs font-mono font-medium transition-all shadow-xs"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>M-109 (+110.7% Crítico)</span>
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.06] p-4 sm:p-5 space-y-3.5 backdrop-blur-sm transition-colors">
        {/* Status Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-white/[0.02] p-1 rounded-xl border border-slate-200/60 dark:border-white/[0.05]">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80 dark:bg-bia-turquoise dark:text-bia-navy-950 dark:border-transparent'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID (ej. M-109)..."
              className="w-full bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-bia-turquoise/50 focus:ring-1 focus:ring-slate-200 dark:focus:ring-bia-turquoise/20 transition-all font-mono"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 text-[11px] uppercase font-mono">
              <ArrowUpDown className="w-3 h-3 text-cyan-600 dark:text-bia-turquoise" />
              Ordenar:
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-bia-turquoise/50 font-sans transition-all"
            >
              <option value="severity">Severidad de Anomalía</option>
              <option value="variation">Variación % de Consumo</option>
              <option value="consumption">Consumo Total</option>
              <option value="meter_id">Identificador (Meter ID)</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:border-white/[0.12] transition-colors text-xs font-mono font-medium shadow-xs"
            >
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>
        </div>
      </div>

      {/* Meters Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.06] overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-3 px-4 font-medium">Medidor</th>
                <th className="py-3 px-4 font-medium">Consumo (24h)</th>
                <th className="py-3 px-4 font-medium">Baseline Diario</th>
                <th className="py-3 px-4 font-medium">Variación %</th>
                <th className="py-3 px-4 font-medium">Estado</th>
                <th className="py-3 px-4 font-medium">Severidad</th>
                <th className="py-3 px-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    Cargando medidores inteligentes de Bia...
                  </td>
                </tr>
              ) : meters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron medidores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                meters.map((m) => {
                  const variation = m.metrics?.variation_pct ?? 0;
                  const isCritical = m.meter_id === 'M-109';
                  const currentKWh = m.metrics?.current_kwh ?? 0;
                  const baselineKWh = m.metrics?.baseline_kwh ?? 1;

                  return (
                    <tr
                      key={m.meter_id}
                      onClick={() => onSelectMeter(m.meter_id)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group ${
                        isCritical ? 'bg-rose-50/40 dark:bg-bia-coral/[0.03]' : ''
                      }`}
                    >
                      {/* Meter ID & Name */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                              isCritical
                                ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-bia-coral/[0.12] dark:text-bia-coral dark:border-bia-coral/30'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-bia-turquoise/[0.08] dark:text-bia-turquoise dark:border-bia-turquoise/20'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-bia-turquoise transition-colors flex items-center gap-1.5 font-mono">
                              {m.meter_id}
                              {isCritical && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-semibold">
                                  CRÍTICO
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-sans">{m.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Observed Consumption (24h) */}
                      <td className="py-3 px-4">
                        <span className="text-slate-900 dark:text-slate-100 font-semibold">
                          {currentKWh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>{' '}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">kWh</span>
                      </td>

                      {/* Baseline Consumption (24h) */}
                      <td className="py-3 px-4">
                        <span className="text-slate-500 dark:text-slate-400">
                          {baselineKWh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>{' '}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">kWh</span>
                      </td>

                      {/* Variation Badge */}
                      <td className="py-3 px-4">
                        <TremorDeltaBadge
                          value={variation}
                          isSeverityCritical={isCritical}
                          size="sm"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 font-sans">
                        <Badge variant="status" value={m.status} size="sm" />
                      </td>

                      {/* Top Severity */}
                      <td className="py-3 px-4 font-sans">
                        {m.metrics?.top_severity ? (
                          <Badge variant="severity" value={m.metrics.top_severity} size="sm" />
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMeter(m.meter_id);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-zinc-900 hover:text-white text-slate-700 border border-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-bia-turquoise dark:hover:text-bia-navy-950 dark:text-slate-300 dark:border-white/[0.06] text-xs font-medium transition-all shadow-xs"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
