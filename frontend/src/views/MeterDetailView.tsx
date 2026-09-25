import React, { useState, useEffect } from 'react';
import { MeterDetailDTO } from '../types/meter';
import { ReadingDTO } from '../types/reading';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { Baseline24hChart } from '../components/charts/Baseline24hChart';
import { Badge } from '../components/common/Badge';
import { TremorTracker, TrackerBlock } from '../components/tremor/TremorTracker';
import { TremorDeltaBadge } from '../components/tremor/TremorDeltaBadge';
import { TremorCallout } from '../components/tremor/TremorCallout';
import {
  ArrowLeft,
  Zap,
  Activity,
  ShieldAlert,
  Cpu,
  ArrowRight,
} from 'lucide-react';

interface MeterDetailViewProps {
  meterId: string;
  onBack: () => void;
  onInvestigateAnomaly: (anomalyId: string) => void;
}

export const MeterDetailView: React.FC<MeterDetailViewProps> = ({
  meterId,
  onBack,
  onInvestigateAnomaly,
}) => {
  const [meter, setMeter] = useState<MeterDetailDTO | null>(null);
  const [readings, setReadings] = useState<ReadingDTO[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [meterData, readingsData, anomaliesData] = await Promise.all([
          api.getMeter(meterId),
          api.getMeterReadings(meterId),
          api.getAnomalies({ meter_id: meterId }),
        ]);
        setMeter(meterData);
        setReadings(readingsData.data);
        setAnomalies(anomaliesData.data);
      } catch (err) {
        console.error('Error loading meter detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [meterId]);

  const activeAnomaly = anomalies[0];
  const isCritical = meter?.status === 'CRITICAL' || meterId === 'M-109';
  const variation = meter?.metrics?.variation_pct ?? 0;

  // Tracker blocks customized for this meter
  const meterTracker: TrackerBlock[] = Array.from({ length: 14 }, (_, i) => {
    const day = i + 1;
    if (meterId === 'M-109') {
      if (day >= 12) return { key: day, color: 'rose', tooltip: `Día ${day}: Anomalía sostenida +110.7%` };
      return { key: day, color: 'emerald', tooltip: `Día ${day}: Operación nominal dentro del baseline` };
    }
    if (meterId === 'M-112') {
      if (day >= 13) return { key: day, color: 'purple', tooltip: `Día ${day}: Lecturas eléctricas inconsistentes` };
      return { key: day, color: 'emerald', tooltip: `Día ${day}: Operación nominal` };
    }
    if (meterId === 'M-104') {
      if (day >= 11) return { key: day, color: 'amber', tooltip: `Día ${day}: Nueva línea productiva (+47.5%)` };
      return { key: day, color: 'emerald', tooltip: `Día ${day}: Operación nominal` };
    }
    if (meterId === 'M-106') {
      if (day === 8) return { key: day, color: 'amber', tooltip: `Día 8: Parada programada 12h` };
      return { key: day, color: 'emerald', tooltip: `Día ${day}: Operación nominal` };
    }
    return { key: day, color: 'emerald', tooltip: `Día ${day}: Nominal 100% OK` };
  });

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bia-navy-850 border border-bia-navy-750 text-xs font-semibold text-slate-300 hover:text-white hover:border-bia-turquoise/40 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Parque de Medidores</span>
        </button>

        {activeAnomaly && (
          <button
            onClick={() => onInvestigateAnomaly(activeAnomaly.id)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-bia-coral hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-bia-coral/30 transition-all active:scale-95"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Auditar Hallazgo ({activeAnomaly.type})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hero Card */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-5 space-y-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${
                  isCritical
                    ? 'bg-bia-coral/20 text-bia-coral border border-bia-coral/40'
                    : 'bg-bia-navy-950 text-bia-turquoise border border-bia-navy-750'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white font-mono tracking-tight">
                    Medidor {meterId}
                  </h1>
                  <Badge variant="status" value={meter?.status || 'OK'} size="md" />
                  {isCritical && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bia-coral text-white">
                      ALERTA CRÍTICA
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  {meter?.name} · Telemetría horaria continua de 14 días (336 horas)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          {meter?.metrics && (
            <div className="flex flex-wrap items-center gap-4 bg-bia-navy-950 p-3.5 rounded-lg border border-bia-navy-750 text-xs font-mono">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Consumo (24h)</p>
                <p className="text-base font-bold text-white">
                  {meter.metrics.current_kwh.toFixed(1)} <span className="text-[10px] text-slate-400">kWh</span>
                </p>
              </div>

              <div className="border-l border-bia-navy-750 pl-4">
                <p className="text-[10px] uppercase font-bold text-slate-400">Baseline Diario</p>
                <p className="text-base font-bold text-slate-300">
                  {meter.metrics.baseline_kwh.toFixed(1)} <span className="text-[10px] text-slate-400">kWh</span>
                </p>
              </div>

              <div className="border-l border-bia-navy-750 pl-4">
                <p className="text-[10px] uppercase font-bold text-slate-400">Variación</p>
                <div className="mt-1">
                  <TremorDeltaBadge value={variation} isSeverityCritical={isCritical} size="md" />
                </div>
              </div>

              <div className="border-l border-bia-navy-750 pl-4">
                <p className="text-[10px] uppercase font-bold text-slate-400">Consumo Periodo</p>
                <p className="text-base font-bold text-bia-turquoise">
                  {meter.metrics.period_kwh.toLocaleString()} <span className="text-[10px] text-slate-400">kWh</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 14-Day Timeline Tracker for this meter */}
        <div className="pt-3 border-t border-bia-navy-750/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 font-mono text-[11px]">
              Registro Diario de Salud de Telemetría:
            </span>
            <span className="font-mono text-slate-400 text-[10px]">
              Verde: Nominal · Rojo: Anomalía Crítica · Ámbar: Operación
            </span>
          </div>
          <TremorTracker data={meterTracker} />
        </div>
      </div>

      {/* Active Anomaly Callout */}
      {activeAnomaly && (
        <TremorCallout
          title={`Anomalía Detectada: ${activeAnomaly.type} (${activeAnomaly.severity})`}
          color={isCritical ? 'rose' : 'amber'}
          action={
            <button
              onClick={() => onInvestigateAnomaly(activeAnomaly.id)}
              className="px-3 py-1.5 rounded-lg bg-bia-coral hover:bg-rose-500 text-white text-xs font-bold transition-colors"
            >
              Investigar Causa Raíz →
            </button>
          }
        >
          {activeAnomaly.reason}
        </TremorCallout>
      )}

      {/* Main TimeSeries Telemetry Chart (Chart.js) */}
      <TimeSeriesChart
        readings={readings}
        anomalyStart={activeAnomaly?.window_start}
        anomalyEnd={activeAnomaly?.window_end}
        title={`Historial de Telemetría Eléctrica (14 Días) — Medidor ${meterId}`}
      />

      {/* 24-Hour Profile & Electrical Reference Values */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Baseline24hChart
            hourlyKwh={meter?.baseline?.hourly_kwh || []}
            dailyTotal={meter?.baseline?.daily_kwh}
            title={`Perfil Horario Típico Calibrado (24h) — Medidor ${meterId}`}
          />
        </div>

        {/* Electrical Reference Card */}
        <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-mono">
            <Activity className="w-3.5 h-3.5 text-bia-turquoise" />
            <span>Parámetros Nominales Calibrados</span>
          </h3>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750">
              <span className="text-slate-400">Voltaje Nominal:</span>
              <span className="font-bold text-white">
                {meter?.baseline?.voltage_v.toFixed(1) || '220.0'} V
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750">
              <span className="text-slate-400">Factor de Potencia Nominal:</span>
              <span className="font-bold text-white">
                {meter?.baseline?.power_factor.toFixed(2) || '0.94'}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750">
              <span className="text-slate-400">Coherencia P / (V·I·FP):</span>
              <span className="font-bold text-bia-turquoise">
                {meter?.baseline?.consumption_ratio.toFixed(3) || '1.055'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-bia-navy-750">
            Parámetros obtenidos de la calibración de los primeros 7 días con mediana y MAD (desviación absoluta respecto a la mediana).
          </p>
        </div>
      </div>
    </div>
  );
};
