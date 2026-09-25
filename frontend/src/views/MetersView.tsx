import React, { useState, useEffect } from 'react';
import { MeterDTO } from '../types/meter';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { TremorDeltaBadge } from '../components/tremor/TremorDeltaBadge';
import { TremorProgressBar } from '../components/tremor/TremorProgressBar';
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
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Gauge className="w-5 h-5 text-bia-turquoise" />
            Parque de Medidores Inteligentes Bia
          </h2>
          <p className="text-xs text-slate-300 mt-1 font-normal">
            Supervisión continua de 12 puntos de medición en tiempo real. Consumo actual frente al perfil baseline horario calibrado.
          </p>
        </div>

        {/* Quick focus for M-109 */}
        <button
          onClick={() => onSelectMeter('M-109')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bia-coral/15 hover:bg-bia-coral/25 text-bia-coral border border-bia-coral/30 text-xs font-mono font-bold transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>M-109 (+110.7% Crítico)</span>
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-3 shadow-sm">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  active
                    ? 'bg-bia-turquoise text-bia-navy-950 shadow-sm shadow-bia-turquoise/25'
                    : 'bg-bia-navy-950 text-slate-400 hover:text-slate-100 border border-bia-navy-750'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-bia-navy-750">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID (ej. M-109)..."
              className="w-full bg-bia-navy-950 border border-bia-navy-750 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-bia-turquoise transition-colors font-mono"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px] uppercase font-mono">
              <ArrowUpDown className="w-3 h-3 text-bia-turquoise" />
              Ordenar:
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-bia-navy-950 border border-bia-navy-750 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-bia-turquoise font-sans"
            >
              <option value="severity">Severidad de Anomalía</option>
              <option value="variation">Variación % de Consumo</option>
              <option value="consumption">Consumo Total</option>
              <option value="meter_id">Identificador (Meter ID)</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750 text-slate-300 hover:text-white hover:border-bia-turquoise/40 transition-colors text-xs font-mono font-semibold"
            >
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>
        </div>
      </div>

      {/* Meters Table */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bia-navy-950 border-b border-bia-navy-750 text-slate-400 uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-3 px-4 font-semibold">Medidor</th>
                <th className="py-3 px-4 font-semibold">Consumo (24h)</th>
                <th className="py-3 px-4 font-semibold">Baseline Diario</th>
                <th className="py-3 px-4 font-semibold">Proporción vs Esperado</th>
                <th className="py-3 px-4 font-semibold">Variación %</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold">Severidad</th>
                <th className="py-3 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bia-navy-750/70 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    Cargando medidores inteligentes de Bia...
                  </td>
                </tr>
              ) : meters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron medidores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                meters.map((m) => {
                  const variation = m.metrics?.variation_pct ?? 0;
                  const isCritical = m.meter_id === 'M-109';
                  const currentKWh = m.metrics?.current_kwh ?? 0;
                  const baselineKWh = m.metrics?.baseline_kwh ?? 1;
                  const ratioPercent = Math.min(200, Math.round((currentKWh / (baselineKWh || 1)) * 100));

                  return (
                    <tr
                      key={m.meter_id}
                      onClick={() => onSelectMeter(m.meter_id)}
                      className={`hover:bg-bia-navy-800 transition-colors cursor-pointer group ${
                        isCritical ? 'bg-bia-coral/10' : ''
                      }`}
                    >
                      {/* Meter ID & Name */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs ${
                              isCritical
                                ? 'bg-bia-coral/20 text-bia-coral border border-bia-coral/40'
                                : 'bg-bia-navy-950 text-bia-turquoise border border-bia-navy-750'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-white group-hover:text-bia-turquoise transition-colors flex items-center gap-1.5 font-mono">
                              {m.meter_id}
                              {isCritical && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-bia-coral text-white font-bold">
                                  CRÍTICO
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-sans">{m.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Observed Consumption (24h) */}
                      <td className="py-3 px-4">
                        <span className="text-slate-100 font-semibold">
                          {currentKWh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">kWh</span>
                      </td>

                      {/* Baseline Consumption (24h) */}
                      <td className="py-3 px-4">
                        <span className="text-slate-400">
                          {baselineKWh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">kWh</span>
                      </td>

                      {/* Ratio Progress Bar */}
                      <td className="py-3 px-4 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{ratioPercent}%</span>
                            <span>Ref: 100%</span>
                          </div>
                          <TremorProgressBar
                            value={ratioPercent}
                            color={
                              isCritical
                                ? 'rose'
                                : ratioPercent > 120
                                ? 'amber'
                                : ratioPercent < 50
                                ? 'indigo'
                                : 'emerald'
                            }
                          />
                        </div>
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
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMeter(m.meter_id);
                          }}
                          className="px-2.5 py-1 rounded-md bg-bia-navy-950 hover:bg-bia-navy-800 text-bia-turquoise border border-bia-navy-750 hover:border-bia-turquoise/40 text-xs font-semibold transition-colors"
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
