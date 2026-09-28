import React, { useState, useEffect, useMemo } from 'react';
import { DashboardDTO } from '../types/dashboard';
import { MeterDTO } from '../types/meter';
import { api } from '../api/client';
import { CopilotContext } from '../components/copilot/AICopilotDrawer';
import { getMeterDisplayName } from '../lib/utils';
import {
  Gauge,
  Zap,
  AlertTriangle,
  Flame,
  Clock,
  ShieldAlert,
  ArrowRight,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';

interface DashboardViewProps {
  summary: DashboardDTO | null;
  loading?: boolean;
  onNavigateToMeter: (meterId: string) => void;
  onAskAI: (context: CopilotContext) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
  onRunAnalysis?: () => void;
  onResetAnalysis?: () => void;
  onNavigateToAnomalies?: () => void;
  onNavigateToInvestigation?: (id: string) => void;
  onOpenDiagnosisDrawer?: (meterId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  loading: _loading,
  onNavigateToMeter,
  onAskAI,
  onRequestTechnicalVisit,
  onRunAnalysis,
  onResetAnalysis: _onResetAnalysis,
  onNavigateToAnomalies,
  onNavigateToInvestigation,
  onOpenDiagnosisDrawer,
}) => {
  const [meters, setMeters] = useState<MeterDTO[]>([]);
  const [metersLoading, setMetersLoading] = useState<boolean>(true);
  const [metersError, setMetersError] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'severity' | 'consumption' | 'variation' | 'id'>('severity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const hasRunAnalysis = Boolean(summary?.last_analysis && (summary?.anomalies_detected ?? 0) > 0);

  const counts = useMemo(() => {
    const valid = meters.filter((m) => m.meter_id !== 'production-summary' && m.name !== 'production-summary');
    if (!hasRunAnalysis) {
      return {
        all: valid.length,
        nominal: valid.length,
        alert: 0,
        critical: 0,
      };
    }
    return {
      all: valid.length,
      nominal: valid.filter((m) => m.status === 'OK' && m.meter_id !== 'M-109').length,
      alert: valid.filter((m) => m.status === 'ALERT').length,
      critical: valid.filter((m) => m.status === 'CRITICAL' || m.meter_id === 'M-109').length,
    };
  }, [meters, hasRunAnalysis]);

  const filteredMeters = useMemo(() => {
    return meters
      .filter((m) => m.meter_id !== 'production-summary' && m.name !== 'production-summary')
      .filter((m) => {
        const isCritical = hasRunAnalysis && (m.status === 'CRITICAL' || m.meter_id === 'M-109');
        const isAlert = hasRunAnalysis && m.status === 'ALERT';
        if (statusFilter === 'NOMINAL') return !isCritical && !isAlert;
        if (statusFilter === 'ALERT') return isAlert;
        if (statusFilter === 'CRITICAL') return isCritical;
        return true;
      })
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const friendlyName = getMeterDisplayName(m.meter_id, m.name).toLowerCase();
        return (
          m.meter_id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          friendlyName.includes(q)
        );
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === 'severity') {
          const score = (m: MeterDTO) => {
            if (!hasRunAnalysis) return 1;
            if (m.status === 'CRITICAL' || m.meter_id === 'M-109' || m.metrics?.top_severity === 'HIGH' || m.metrics?.top_severity === 'CRITICAL') return 3;
            if (m.status === 'ALERT' || m.metrics?.top_severity === 'MEDIUM' || m.meter_id === 'M-112') return 2;
            return 1;
          };
          comp = score(b) - score(a);
          if (comp === 0) {
            comp = Math.abs(b.metrics?.variation_pct ?? 0) - Math.abs(a.metrics?.variation_pct ?? 0);
          }
        } else if (sortField === 'consumption') {
          comp = (b.metrics?.current_kwh ?? 0) - (a.metrics?.current_kwh ?? 0);
        } else if (sortField === 'variation') {
          comp = Math.abs(b.metrics?.variation_pct ?? 0) - Math.abs(a.metrics?.variation_pct ?? 0);
        } else if (sortField === 'id') {
          comp = a.meter_id.localeCompare(b.meter_id);
        }
        return sortOrder === 'desc' ? comp : -comp;
      });
  }, [meters, statusFilter, searchQuery, sortField, sortOrder, hasRunAnalysis]);

  useEffect(() => {
    let isMounted = true;
    setMetersLoading(true);
    setMetersError(false);

    api
      .getMeters()
      .then((res) => {
        if (isMounted) {
          if (res.data && res.data.length > 0) {
            setMeters(res.data);
          }
          setMetersLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching meters on dashboard:', err);
        if (isMounted) {
          setMetersError(true);
          setMetersLoading(false);
        }
      });

    const handleAnalysisCompleted = () => {
      api
        .getMeters()
        .then((res) => {
          if (res.data && res.data.length > 0) setMeters(res.data);
        })
        .catch(() => { });
    };

    window.addEventListener('bia:analysis-completed', handleAnalysisCompleted);
    return () => {
      isMounted = false;
      window.removeEventListener('bia:analysis-completed', handleAnalysisCompleted);
    };
  }, []);

  const lastRun = summary?.last_analysis;

  const handleOpenDiagnosis = (meterId: string = 'M-109') => {
    if (onOpenDiagnosisDrawer) {
      onOpenDiagnosisDrawer(meterId);
    } else {
      onNavigateToMeter(meterId);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Badge & Copilot Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 dark:bg-teal-950/70 dark:text-teal-400 dark:border-teal-800/60">
              SUPERVISIÓN DE PLANTA
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              • {summary?.total_meters ?? (meters.length > 0 ? meters.length : '—')} Medidores • {summary ? 'Telemetría en Tiempo Real' : 'Sin conexión'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard Energético
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Resumen de indicadores clave de planta y gestión del parque de medidores inteligentes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              onAskAI({
                type: 'general',
                id: 'copilot-assistant',
                title: 'Asistente Bia IA',
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 dark:text-teal-400 dark:border-teal-700/60 transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Consultar Asistente Bia IA</span>
          </button>
        </div>
      </div>

      {/* Backend offline warning banner */}
      {!_loading && !summary && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          <div className="flex-1">
            <span className="font-semibold">Servicio backend desconectado:</span>{' '}
            <span>No se pudo conectar con el servidor de telemetría (puerto 8080). Inicia el backend para recibir métricas y telemetría en tiempo real.</span>
          </div>
        </div>
      )}

      {/* 2. 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        {/* Card 1: Medidores */}
        <div
          onClick={() => onNavigateToMeter('M-101')}
          className="bg-white border border-slate-200/80 hover:border-teal-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-teal-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Medidores
            </span>
            <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-600 dark:bg-teal-950/60 dark:border-teal-800/60 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Gauge className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {summary?.total_meters != null
                ? summary.total_meters
                : (_loading ? '...' : (meters.length > 0 ? meters.length : '—'))}
            </span>
            {summary?.total_meters != null && (
              <span className="text-sm font-mono text-teal-600 dark:text-teal-400 ml-1.5 font-semibold">
                / {summary.total_meters}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span className="text-slate-500 dark:text-slate-400">Parque activo</span>
            <span className={summary ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-slate-400 dark:text-slate-500 font-medium'}>
              {summary ? '100% En línea' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Card 2: Consumo */}
        <div
          onClick={() =>
            onAskAI({
              type: 'general',
              id: 'total-consumption',
              title: 'Consumo Agregado de Planta',
            })
          }
          className="bg-white border border-slate-200/80 hover:border-teal-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-teal-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Consumo
            </span>
            <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-600 dark:bg-teal-950/60 dark:border-teal-800/60 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {summary?.total_consumption_kwh != null
                ? (summary.total_consumption_kwh / 1000).toFixed(1)
                : (_loading ? '...' : '—')}
            </span>
            {summary?.total_consumption_kwh != null && (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1.5">
                MWh
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span className="text-slate-500 dark:text-slate-400">Total periodo</span>
            <span className={summary ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-slate-400 dark:text-slate-500 font-medium'}>
              {summary ? '14 días (336h)' : 'Sin datos'}
            </span>
          </div>
        </div>

        {/* Card 3: Anomalías IA */}
        <div
          onClick={onNavigateToAnomalies}
          className="bg-white border border-slate-200/80 hover:border-amber-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Anomalías IA
            </span>
            <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-950/60 dark:border-amber-800/60 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {summary?.anomalies_detected != null
                ? summary.anomalies_detected
                : (_loading ? '...' : '—')}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400/90 ml-1.5">
              {summary ? 'Detectadas' : 'Sin datos'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span className="text-slate-500 dark:text-slate-400">Motor IA</span>
            <span className="text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium group-hover:underline">
              {summary ? 'Ver todas →' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Card 4: Alta Prioridad */}
        <div
          onClick={() => handleOpenDiagnosis('M-109')}
          className="bg-white border border-slate-200/80 hover:border-rose-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-rose-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-rose-600 dark:text-rose-400 uppercase">
              Alta Prioridad
            </span>
            <div className="w-7 h-7 rounded-full bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-500">
              {summary?.high_priority != null
                ? summary.high_priority
                : (_loading ? '...' : '—')}
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 ml-1.5">
              {summary ? 'Críticas' : 'Sin datos'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span className="text-slate-500 dark:text-slate-400">Atención urgente</span>
            <span className="text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium group-hover:underline">
              {summary && summary.high_priority > 0 ? 'M-109 / M-112 →' : (summary ? '0 Alertas' : '—')}
            </span>
          </div>
        </div>

        {/* Card 5: Confianza IA */}
        <div
          onClick={() =>
            onAskAI({
              type: 'general',
              id: 'ai-confidence',
              title: 'Certeza y Calibración IA',
            })
          }
          className="bg-white border border-slate-200/80 hover:border-teal-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-teal-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Confianza Del Analisis
            </span>
            <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-600 dark:bg-teal-950/60 dark:border-teal-800/60 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {summary?.avg_confidence != null
                ? `${(summary.avg_confidence * 100).toFixed(1)}%`
                : (_loading ? '...' : '—')}
            </span>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 ml-1.5">
              {summary ? 'Promedio' : 'Sin datos'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span className="text-slate-500 dark:text-slate-400">Métrica agregada</span>
            <span className={summary ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-slate-400 dark:text-slate-500 font-medium'}>
              {summary ? 'Alta precisión' : 'Sin conexión'}
            </span>
          </div>
        </div>

        {/* Card 6: Último Análisis */}
        <div
          onClick={onRunAnalysis}
          className="bg-white border border-slate-200/80 hover:border-teal-500/40 dark:bg-[#0c101d] dark:border-[#1b243b] dark:hover:border-teal-500/40 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs dark:shadow-sm group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Último Análisis
            </span>
            <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200 text-teal-600 dark:bg-teal-950/60 dark:border-teal-800/60 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline mb-3">
            <span className="text-xl font-bold text-teal-600 dark:text-teal-400">
              {lastRun?.status === 'COMPLETED'
                ? 'Completado'
                : (lastRun?.status || (_loading ? '...' : (summary ? 'Pendiente' : 'Desconectado')))}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono pt-2 border-t border-slate-100 dark:border-[#182136]">
            <span>🕒 Ejecutado</span>
            <span>
              {lastRun?.finished_at
                ? new Date(lastRun.finished_at).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : (summary ? 'Sin ejecuciones' : '—')}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Parque de Medidores Inteligentes Panel */}
      <div className="bg-white border border-slate-200/80 shadow-xs dark:bg-[#0c101d] dark:border-[#1b243b] dark:shadow-md rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Panel Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Parque de Medidores Inteligentes
              </h2>
              <span className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200/80 dark:text-slate-400 dark:bg-[#161d31] dark:border-[#222c47] px-2.5 py-0.5 rounded-md">
                {meters.length > 0 ? `${meters.length} Unidades` : (metersLoading ? 'Cargando...' : '0 Unidades')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Selecciona <strong className="text-slate-700 dark:text-slate-300 font-medium">Ver Detalle</strong> en cualquier medidor para entrar a ver sus gráficas de telemetría y diagnósticos de IA.
            </p>
          </div>
        </div>

        {/* Toolbar: Status Filter Tabs, Search & Sort */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${statusFilter === 'ALL'
                ? 'bg-teal-600 text-white shadow-xs dark:bg-teal-400 dark:text-slate-950'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
                }`}
            >
              <span>Todos los Medidores</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${statusFilter === 'ALL' ? 'bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-950' : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                {counts.all}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('NOMINAL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${statusFilter === 'NOMINAL'
                ? 'bg-teal-600 text-white shadow-xs dark:bg-teal-400 dark:text-slate-950'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
                }`}
            >
              <span>Nominales</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${statusFilter === 'NOMINAL' ? 'bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-950' : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                {counts.nominal}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ALERT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${statusFilter === 'ALERT'
                ? 'bg-amber-600 text-white shadow-xs dark:bg-amber-500 dark:text-slate-950'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
                }`}
            >
              <span>En Alerta</span>
              {counts.alert > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${statusFilter === 'ALERT' ? 'bg-white/20 text-white dark:bg-slate-900/30 dark:text-slate-950' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400'}`}>
                  {counts.alert}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CRITICAL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${statusFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-xs dark:bg-rose-500 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.04]'
                }`}
            >
              <span>Críticos</span>
              {counts.critical > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${statusFilter === 'CRITICAL' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-400'}`}>
                  {counts.critical}
                </span>
              )}
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar medidor (ej. M-109)"
                className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 dark:bg-[#0e1424] dark:border-[#1f2942] dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-teal-400/50 text-xs w-56 sm:w-60 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5 rounded cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Field Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 dark:bg-[#0e1424] dark:border-[#1f2942] dark:text-slate-300 rounded-lg px-2.5 py-1.5 text-xs transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent border-none text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="severity" className="bg-white text-slate-800 dark:bg-[#0e1424] dark:text-slate-200">Severidad</option>
                <option value="consumption" className="bg-white text-slate-800 dark:bg-[#0e1424] dark:text-slate-200">Consumo</option>
                <option value="variation" className="bg-white text-slate-800 dark:bg-[#0e1424] dark:text-slate-200">Variación</option>
                <option value="id" className="bg-white text-slate-800 dark:bg-[#0e1424] dark:text-slate-200">ID Medidor</option>
              </select>
            </div>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 dark:bg-[#0e1424] dark:border-[#1f2942] dark:hover:border-slate-600 text-xs font-semibold dark:text-slate-300 transition-colors cursor-pointer"
              title={`Orden: ${sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}`}
            >
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>
        </div>

        {/* Meters Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-[#1b243b]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:border-[#1b243b] dark:bg-[#090d18] dark:text-slate-400">
                <th className="py-3 px-4">Medidor</th>
                <th className="py-3 px-4">Consumo (24h)</th>
                <th className="py-3 px-4">Baseline Diario</th>
                <th className="py-3 px-4">Variación %</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Severidad</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#182136] text-xs">
              {metersLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                      <span>Cargando parque de medidores...</span>
                    </div>
                  </td>
                </tr>
              ) : metersError || (!summary && meters.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        No se pudo conectar con el servidor backend
                      </span>
                      <span className="text-[11px] text-slate-500 max-w-md">
                        Verifica que el servicio backend esté en ejecución en el puerto 8080 para cargar los medidores y la telemetría en tiempo real.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredMeters.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 font-mono text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span>No se encontraron medidores con los filtros seleccionados.</span>
                      {(statusFilter !== 'ALL' || searchQuery.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('ALL');
                            setSearchQuery('');
                          }}
                          className="mt-1 px-3 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 dark:text-teal-400 dark:border-teal-700/60 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMeters.map((m) => {
                  const isCritical = hasRunAnalysis && (m.status === 'CRITICAL' || m.meter_id === 'M-109');
                  const isAlert = hasRunAnalysis && m.status === 'ALERT';
                  const currentKwh = m.metrics?.current_kwh ?? 0;
                  const baselineKwh = m.metrics?.baseline_kwh ?? 1;
                  const variation = hasRunAnalysis ? (m.metrics?.variation_pct ?? 0) : 0;

                  // Severity determination
                  let severityLabel = '—';
                  let severityColor = 'text-slate-400 dark:text-slate-500';
                  let severityDot = '';
                  if (isCritical || m.metrics?.top_severity === 'CRITICAL') {
                    severityLabel = 'Alta';
                    severityColor = 'text-rose-600 dark:text-rose-400';
                    severityDot = 'bg-rose-500';
                  } else if (isAlert && m.meter_id === 'M-112') {
                    severityLabel = 'Alta';
                    severityColor = 'text-rose-600 dark:text-rose-400';
                    severityDot = 'bg-rose-500';
                  } else if (isAlert && m.meter_id === 'M-104') {
                    severityLabel = 'Media';
                    severityColor = 'text-amber-600 dark:text-amber-400';
                    severityDot = 'bg-amber-400';
                  }

                  return (
                    <tr
                      key={m.meter_id}
                      onClick={() => onNavigateToMeter(m.meter_id)}
                      className="group hover:bg-slate-50/80 dark:hover:bg-[#12182b] transition-colors cursor-pointer"
                    >
                      {/* Medidor ID & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCritical
                              ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60'
                              : 'bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-400 dark:border-teal-800/60'
                              }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900 group-hover:text-teal-600 dark:text-white dark:group-hover:text-teal-400 transition-colors">
                                {m.meter_id}
                              </span>
                              {isCritical && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono uppercase">
                                  Crítico
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                              {getMeterDisplayName(m.meter_id, m.name)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Consumo (24h) */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {currentKwh.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">kWh</span>
                      </td>

                      {/* Baseline Diario */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-slate-700 dark:text-slate-300">
                          {baselineKwh.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>{' '}
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">kWh</span>
                      </td>

                      {/* Variación % Pill */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs font-semibold ${isCritical
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/50'
                            : isAlert || variation > 10
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/50'
                              : 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800/50'
                            }`}
                        >
                          <TrendingUp className="w-3 h-3" />
                          <span>
                            {variation >= 0 ? '+' : ''}
                            {variation.toFixed(1)}%
                          </span>
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Crítico
                          </span>
                        ) : isAlert ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Alerta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-teal-400" />
                            Nominal
                          </span>
                        )}
                      </td>

                      {/* Severidad */}
                      <td className="py-3.5 px-4">
                        {severityDot ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${severityColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${severityDot}`} />
                            {severityLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Acción Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMeter(m.meter_id);
                          }}
                          className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                        >
                          Ver Detalle
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
