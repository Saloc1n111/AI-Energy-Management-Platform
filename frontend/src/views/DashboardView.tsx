import React from 'react';
import { DashboardDTO } from '../types/dashboard';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { BreakdownChart } from '../components/charts/BreakdownChart';
import { TremorCallout } from '../components/tremor/TremorCallout';
import { TremorTracker, TrackerBlock } from '../components/tremor/TremorTracker';
import {
  Gauge,
  Zap,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Play,
  ArrowRight,
  Clock,
  ChevronRight,
  ShieldAlert,
  Activity,
  Layers,
} from 'lucide-react';

interface DashboardViewProps {
  summary: DashboardDTO | null;
  loading?: boolean;
  onRunAnalysis: () => void;
  onNavigateToMeter: (meterId: string) => void;
  onNavigateToAnomalies: () => void;
  onNavigateToInvestigation: (anomalyId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  onRunAnalysis,
  onNavigateToMeter,
  onNavigateToAnomalies,
  onNavigateToInvestigation,
}) => {
  const lastRun = summary?.last_analysis;
  
  // Default dataset cases if summary not yet populated
  const defaultTopPriority = [
    {
      id: 'anm_m109_20260912T1400',
      meter_id: 'M-109',
      type: 'REAL_ANOMALY',
      severity: 'HIGH',
      priority_score: 89.5,
      reason: 'Incremento sostenido de +110.7% en consumo diario sin registro de parada ni cambio de turno. Caída de factor de potencia a 0.74 y elevación de corriente a 424A.',
      recommended_action: 'Inspección física urgente de carga y verificar calentamiento en tablero de distribución.',
      status: 'OPEN',
    },
    {
      id: 'anm_m112_20260913T0000',
      meter_id: 'M-112',
      type: 'DATA_QUALITY',
      severity: 'HIGH',
      priority_score: 33.0,
      reason: 'Consumo constante (desvío 0.4%) mientras voltaje y factor de potencia presentan saltos abruptos e inconsistencia de telemetría durante 16 horas.',
      recommended_action: 'Revisión y recalibración de transductores de medición en medidor M-112.',
      status: 'OPEN',
    },
    {
      id: 'anm_m104_20260911T0000',
      meter_id: 'M-104',
      type: 'EXPLAINABLE_ANOMALY',
      severity: 'MEDIUM',
      priority_score: 22.0,
      reason: 'Aumento sostenido de +47.5% en consumo y +47.1% en corriente, coincidente con evento operacional "New production line activated". Parámetros eléctricos normales.',
      recommended_action: 'Validar registro en sistema de gestión de producción y actualizar nuevo perfil de línea base.',
      status: 'OPEN',
    },
    {
      id: 'anm_m106_20260908T0600',
      meter_id: 'M-106',
      type: 'FALSE_POSITIVE',
      severity: 'LOW',
      priority_score: 12.0,
      reason: 'Caída de consumo de -99.5% durante 6 horas, plenamente alineada con evento "Scheduled boiler maintenance". Corriente cae a 0A y voltaje permanece estable.',
      recommended_action: 'No requiere acción correctiva. Proceder a cierre de incidencia.',
      status: 'OPEN',
    },
  ];

  const topPriority = (summary?.top_priority && summary.top_priority.length > 0)
    ? summary.top_priority
    : defaultTopPriority;

  // 14-day telemetry tracker blocks
  const trackerData: TrackerBlock[] = [
    { key: 1, color: 'emerald', tooltip: 'Día 1: Consumo nominal' },
    { key: 2, color: 'emerald', tooltip: 'Día 2: Consumo nominal' },
    { key: 3, color: 'emerald', tooltip: 'Día 3: Consumo nominal' },
    { key: 4, color: 'emerald', tooltip: 'Día 4: Consumo nominal' },
    { key: 5, color: 'emerald', tooltip: 'Día 5: Consumo nominal' },
    { key: 6, color: 'emerald', tooltip: 'Día 6: Consumo nominal' },
    { key: 7, color: 'emerald', tooltip: 'Día 7: Fin calibración baseline' },
    { key: 8, color: 'amber', tooltip: 'Día 8: Parada programada (M-106)' },
    { key: 9, color: 'emerald', tooltip: 'Día 9: Retorno a baseline' },
    { key: 10, color: 'emerald', tooltip: 'Día 10: Operación normal' },
    { key: 11, color: 'amber', tooltip: 'Día 11: Nueva línea productiva (M-104)' },
    { key: 12, color: 'rose', tooltip: 'Día 12: Desvío crítico +110.7% (M-109)' },
    { key: 13, color: 'purple', tooltip: 'Día 13: Inconsistencias de telemetría (M-112)' },
    { key: 14, color: 'rose', tooltip: 'Día 14: Anomalía sostenida activa' },
  ];

  const m109Anomaly = topPriority.find((a) => a.meter_id === 'M-109');

  return (
    <div className="space-y-6">
      {/* Alert Callout for M-109 */}
      {m109Anomaly && (
        <TremorCallout
          title="Atención Inmediata Requerida: Medidor M-109"
          color="rose"
          action={
            <button
              onClick={() => onNavigateToInvestigation(m109Anomaly.id)}
              className="px-3.5 py-1.5 rounded-lg bg-bia-coral hover:bg-rose-500 text-white font-bold text-xs tracking-tight shadow-sm shadow-bia-coral/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>Abrir Sala de Decisión</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          Incremento anómalo no programado de <strong>+110.7% en consumo diario</strong>. Corriente elevada a 424A con caída de factor de potencia a 0.74. Clasificado como <strong>Anomalía Real Crítica</strong>.
        </TremorCallout>
      )}

      {/* Hero Header: Bia Energy Control Center */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-bia-turquoise bg-bia-navy-950 px-2 py-0.5 rounded border border-bia-turquoise/30">
                Bia Energy Platform
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-bia-turquoise shadow-sm shadow-bia-turquoise" />
                Telemetría en Tiempo Real · 14 Días
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Monitor General de Telemetría Eléctrica
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Supervisión de 12 medidores inteligentes (4.032 lecturas horarias). Perfil horario baseline calculado con mediana + MAD y validación multivariable de corriente, voltaje y factor de potencia.
            </p>

            {lastRun?.message && (
              <div className="pt-1 flex items-center gap-2 text-xs font-mono text-bia-turquoise">
                <span className="w-1.5 h-1.5 rounded-full bg-bia-turquoise animate-pulse" />
                <span>Estado: {lastRun.message}</span>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={onRunAnalysis}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 active:scale-95 shadow-sm shadow-bia-turquoise/25 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ejecutar Diagnóstico</span>
            </button>

            <button
              onClick={() => onNavigateToMeter('M-109')}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs bg-bia-navy-950 hover:bg-bia-navy-800 text-bia-coral border border-bia-coral/40 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-bia-coral" />
              <span>Ver Medidor M-109</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Medidores"
          value={summary?.total_meters || 12}
          unit="unidades"
          subtitle="100% telemedidos"
          icon={<Gauge className="w-4 h-4" />}
        />

        <StatCard
          title="Consumo Total"
          value={
            summary?.total_consumption_kwh
              ? Math.round(summary.total_consumption_kwh / 1000).toLocaleString()
              : '155'
          }
          unit="MWh"
          subtitle="Ventana 14 días"
          delta={2.5}
          icon={<Zap className="w-4 h-4" />}
        />

        <StatCard
          title="Anomalías"
          value={summary?.anomalies_detected ?? 4}
          unit="detectadas"
          subtitle="Dataset evaluado"
          icon={<AlertTriangle className="w-4 h-4 text-bia-amber" />}
          onClick={onNavigateToAnomalies}
        />

        <StatCard
          title="Alta Prioridad"
          value={summary?.high_priority ?? 2}
          unit="requieren acción"
          subtitle="M-109 y M-112"
          delta={100}
          isSeverityCritical={true}
          icon={<Flame className="w-4 h-4 text-bia-coral" />}
          onClick={onNavigateToAnomalies}
        />

        <StatCard
          title="Certeza IA"
          value={`${Math.round((summary?.avg_confidence || 0.95) * 100)}%`}
          unit="score"
          subtitle="gemini-3.5-flash-lite"
          icon={<ShieldCheck className="w-4 h-4 text-bia-turquoise" />}
        />

        <StatCard
          title="Pipeline"
          value={lastRun?.status || 'COMPLETED'}
          subtitle={
            lastRun?.finished_at
              ? new Date(lastRun.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Calibrado'
          }
          icon={<Clock className="w-4 h-4 text-bia-turquoise" />}
          onClick={onRunAnalysis}
        />
      </div>

      {/* 14-Day Timeline Status Bar */}
      <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-bia-turquoise" />
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-200 font-mono">
              Línea de Tiempo de Telemetría (14 Días)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            4.032 lecturas horarias
          </span>
        </div>

        <TremorTracker data={trackerData} />
      </div>

      {/* Main Content Grid: Top Priority Triage & Breakdown Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Triage: Top Priority Anomalies (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-bia-coral" />
                <span>Triage de Incidencias Prioritarias</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ordenado por: Severidad → Tipo de Hallazgo → Score de Prioridad
              </p>
            </div>

            <button
              onClick={onNavigateToAnomalies}
              className="text-xs font-semibold text-bia-turquoise hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Ver todas ({summary?.anomalies_detected || 4})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {topPriority.map((a, idx) => {
              const isCritical = a.meter_id === 'M-109';

              return (
                <div
                  key={a.id}
                  onClick={() => onNavigateToInvestigation(a.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                    isCritical
                      ? 'bg-bia-navy-850 border-bia-coral/40 hover:border-bia-coral hover:bg-bia-navy-800'
                      : 'bg-bia-navy-850 border-bia-navy-750 hover:border-bia-turquoise/40 hover:bg-bia-navy-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-bia-navy-950 text-slate-400 border border-bia-navy-750">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white group-hover:text-bia-turquoise transition-colors font-mono">
                        {a.meter_id}
                      </span>
                      <Badge variant="type" value={a.type} size="sm" />
                      <Badge variant="severity" value={a.severity} size="sm" />
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 text-[11px] font-mono">Score:</span>
                      <span className="font-mono font-bold text-bia-turquoise">
                        {a.priority_score}
                      </span>
                      <Badge variant="status" value={a.status} size="sm" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {a.reason}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-bia-navy-750 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-normal truncate max-w-lg">
                      Acción: <strong className="text-slate-200 font-semibold">{a.recommended_action}</strong>
                    </span>
                    <span className="text-bia-turquoise font-bold text-xs flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0">
                      Investigar <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown Chart & Workflow Helper (1 col) */}
        <div className="space-y-4">
          <BreakdownChart
            byType={
              summary?.by_type || {
                REAL_ANOMALY: 1,
                DATA_QUALITY: 1,
                EXPLAINABLE_ANOMALY: 1,
                FALSE_POSITIVE: 1,
              }
            }
          />

          <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-3 text-xs shadow-sm">
            <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-bia-turquoise" />
              <span>Ciclo de Decisión Operativa</span>
            </h3>
            <p className="text-slate-300 leading-relaxed font-normal">
              Flujo end-to-end implementado para resolución de incidencias energéticas:
            </p>
            <div className="p-2.5 rounded-lg bg-bia-navy-950 border border-bia-navy-750 font-mono text-[10px] text-slate-400 space-y-1">
              <p className="text-bia-turquoise font-bold">TELEMETRÍA → BASELINE 7D → DETECCIÓN</p>
              <p>→ MULTIVARIABLE → EXPLICACIÓN → ACCIÓN</p>
            </div>
            <button
              onClick={() => onNavigateToMeter('M-109')}
              className="w-full py-2 px-3 rounded-lg bg-bia-navy-950 hover:bg-bia-navy-800 text-bia-turquoise font-semibold transition-colors text-center text-xs border border-bia-turquoise/30"
            >
              Auditar Hallazgo M-109 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
