import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Wrench,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Activity,
  ArrowRight,
  ShieldAlert,
  X,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { CopilotContext } from '../copilot/AICopilotDrawer';
import { AnomalyDTO } from '../../types/anomaly';
import { api } from '../../api/client';

export interface AlertDiagnosisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMeterId?: string;
  selectedAnomalyId?: string;
  anomalies?: AnomalyDTO[];
  onRequestTechnicalVisit: (meterId: string) => void;
  onAskAI: (ctx: CopilotContext) => void;
  onNavigateToInvestigation: (anomalyId: string) => void;
  onNavigateToMeter: (meterId: string) => void;
}

interface DrawerMeterProfile {
  meterId: string;
  name: string;
  location: string;
  badgeText: string;
  badgeStyle: string;
  isCritical: boolean;
  bannerTitle: string;
  deltaTag: string;
  explanation: string;
  question: string;
  questionHint: string;
  optionNoTitle: string;
  optionNoDesc: string;
  riskWarning: string;
  optionYesTitle: string;
  optionYesDesc: string;
  rebaselineAction: string;
  dailyKwh: string;
  dailyKwhDelta: string;
  isKwhDeltaAlert: boolean;
  metric2Label: string;
  metric2Value: string;
  metric2Delta: string;
  isMetric2Alert: boolean;
  powerFactor: string;
  pfDelta: string;
  isPfAlert: boolean;
  zScore: string;
  zScoreDesc: string;
  physicalValidation: string;
  suggestedAnomalyId: string;
}

function buildDynamicProfile(meterId: string, anomaly?: any): DrawerMeterProfile {
  const isCritical = anomaly?.severity === 'HIGH';
  const isDataQuality = anomaly?.type === 'DATA_QUALITY';
  const badgeText = isCritical ? 'ALERTA CRÍTICA' : isDataQuality ? 'CALIDAD DE DATOS' : anomaly ? 'ANOMALÍA DETECTADA' : 'EN SEGUIMIENTO';
  const badgeStyle = isCritical
    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    : isDataQuality
    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    : 'bg-white/[0.04] text-slate-300 border-white/[0.08]';

  return {
    meterId,
    name: `Medidor ${meterId}`,
    location: anomaly?.meter_id === meterId ? 'Subestación / Planta' : 'Área Industrial',
    badgeText,
    badgeStyle,
    isCritical,
    bannerTitle: anomaly?.title || `Seguimiento de Demanda Energética en ${meterId}`,
    deltaTag: isCritical ? 'Sobrecarga Crítica' : 'En monitoreo',
    explanation: anomaly?.reason || `Supervisión de telemetría y variables eléctricas en el medidor ${meterId}.`,
    question: '¿Realizaste algún cambio en tu operación que explique este comportamiento?',
    questionHint: 'Por ejemplo: ¿se encendieron nuevas máquinas, se ampliaron turnos de producción o hubo pruebas de carga?',
    optionNoTitle: 'No reconozco este cambio (Operación Habitual)',
    optionNoDesc: 'La planta funcionó con su carga de rutina sin modificaciones autorizadas.',
    riskWarning: isCritical
      ? '🚨 Riesgo detectado: Un sobreconsumo sostenido con caída de factor de potencia indica posible sobrecalentamiento, fuga inductiva o desbalance severo.'
      : 'Verificar la coherencia de telemetría con los registros de supervisión técnica de planta.',
    optionYesTitle: 'Sí, reconozco un cambio en la operación',
    optionYesDesc: 'Activación de nueva maquinaria, producción extraordinaria o turno adicional autorizado.',
    rebaselineAction: '👉 Actualización de Línea Base: Registra este nuevo perfil para recalibrar el modelo de detección y evitar falsas alertas.',
    dailyKwh: 'Nominal',
    dailyKwhDelta: isCritical ? '+110.7% vs baseline' : 'Dentro de rango',
    isKwhDeltaAlert: isCritical,
    metric2Label: 'Corriente (I)',
    metric2Value: isCritical ? '424 A' : 'Nominal',
    metric2Delta: isCritical ? 'Elevada' : 'Estable',
    isMetric2Alert: isCritical,
    powerFactor: isCritical ? '0.74' : '0.94',
    pfDelta: isCritical ? 'Baja eficiencia' : 'Nominal',
    isPfAlert: isCritical,
    zScore: anomaly?.evidence?.[0]?.deviation_pct ? `${(Number(anomaly.evidence[0].deviation_pct) / 25).toFixed(2)} σ` : '1.80 σ',
    zScoreDesc: isCritical ? 'Umbral crítico superado' : 'Régimen estándar',
    physicalValidation: anomaly?.reason || 'Telemetría balanceada dentro de los parámetros de diseño.',
    suggestedAnomalyId: anomaly?.id || `anm_${meterId.toLowerCase()}`,
  };
}

export const AlertDiagnosisDrawer: React.FC<AlertDiagnosisDrawerProps> = ({
  isOpen,
  onClose,
  selectedMeterId = 'M-109',
  selectedAnomalyId = 'anm_m109_20260912T1400',
  anomalies = [],
  onRequestTechnicalVisit,
  onAskAI,
  onNavigateToInvestigation,
  onNavigateToMeter,
}) => {
  const [activeMeter, setActiveMeter] = useState<string>(selectedMeterId);
  const [operationalChange, setOperationalChange] = useState<'yes' | 'no'>('no');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(true);
  const [baselineUpdated, setBaselineUpdated] = useState<boolean>(false);

  // Sync active meter when prop changes
  useEffect(() => {
    if (selectedMeterId) {
      setActiveMeter(selectedMeterId);
      setOperationalChange('no');
      setBaselineUpdated(false);
    }
  }, [selectedMeterId]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeProfile: DrawerMeterProfile =
    buildDynamicProfile(activeMeter, anomalies.find((a) => a.meter_id === activeMeter)) || {
      meterId: activeMeter,
      name: `Medidor ${activeMeter}`,
      location: 'Área Industrial',
      badgeText: 'EN SEGUIMIENTO',
      badgeStyle: 'bg-white/[0.04] text-slate-300 border-white/[0.08]',
      isCritical: false,
      bannerTitle: `Seguimiento de Demanda Energética en ${activeMeter}`,
      deltaTag: 'En monitoreo',
      explanation: `Supervisión de telemetría y variables eléctricas en el medidor ${activeMeter}.`,
      question: '¿Reconoces cambios operativos en este punto de medición?',
      questionHint:
        'Indica si hubo mantenimientos o modificaciones en el consumo de los equipos asociados.',
      optionNoTitle: 'Operación Habitual sin Cambios',
      optionNoDesc: 'La carga operó bajo condiciones estándar.',
      riskWarning:
        'Verificar la coherencia de telemetría con los registros de supervisión técnica de planta.',
      optionYesTitle: 'Cambio Operativo Realizado',
      optionYesDesc: 'Modificación autorizada de equipos o turnos.',
      rebaselineAction:
        'Se registra el evento para actualizar la línea base del punto de medida.',
      dailyKwh: 'Nominal',
      dailyKwhDelta: 'Dentro de rango',
      isKwhDeltaAlert: false,
      metric2Label: 'Corriente (I)',
      metric2Value: 'Nominal',
      metric2Delta: 'Estable',
      isMetric2Alert: false,
      powerFactor: '0.92',
      pfDelta: 'Nominal',
      isPfAlert: false,
      zScore: '1.20 σ',
      zScoreDesc: 'Régimen estándar',
      physicalValidation: 'Telemetría balanceada dentro de los parámetros de diseño.',
      suggestedAnomalyId: selectedAnomalyId || `anm_${activeMeter.toLowerCase()}`,
    };

  // Selected anomaly details from backend if available, otherwise active profile
  const activeAnomaly = anomalies.find((a) => a.meter_id === activeMeter) || {
    id: activeProfile.suggestedAnomalyId,
    meter_id: activeMeter,
    run_id: 'run-seed',
    detected_at: '2026-09-14T23:00:00',
    type: activeProfile.isCritical ? 'REAL_ANOMALY' : 'DATA_QUALITY',
    severity: activeProfile.isCritical ? 'HIGH' : 'MEDIUM',
    priority_score: activeProfile.isCritical ? 89.5 : 30.0,
    confidence: 0.95,
    confidence_label: 'HIGH',
    confidence_factors: [],
    requires_attention: activeProfile.isCritical,
    signals: [],
    anomaly: true,
    reason: activeProfile.explanation,
    recommended_action: activeProfile.riskWarning,
    investigation_steps: [],
    explained_by: '',
    evidence: [],
    related_event: null,
    status: 'OPEN',
    window_start: '2026-09-12T14:00:00',
    window_end: '2026-09-14T23:00:00',
  };

  const handleUpdateBaseline = async () => {
    setBaselineUpdated(true);
    try {
      if (activeAnomaly.id) {
        await api.updateAnomalyStatus(activeAnomaly.id, 'RESOLVED');
        window.dispatchEvent(new CustomEvent('bia:analysis-completed'));
      }
    } catch (e) {
      console.warn('Could not update anomaly status:', e);
    }
    setTimeout(() => setBaselineUpdated(false), 4000);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-xl h-full bg-white dark:bg-bia-navy-900 border-l border-slate-200/80 dark:border-white/[0.08] shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 z-10 overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-bia-navy-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-xs shrink-0 ${
                activeProfile.isCritical
                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-bia-coral/15 dark:border-bia-coral/40 dark:text-bia-coral shadow-bia-coral/20'
                  : 'bg-teal-50 border-teal-200 text-teal-600 dark:bg-bia-turquoise/15 dark:border-bia-turquoise/40 dark:text-bia-turquoise shadow-bia-turquoise/20'
              }`}
            >
              {activeProfile.isCritical ? (
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="alert-drawer-title"
                  className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight"
                >
                  Panel de Diagnóstico Operativo
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${activeProfile.badgeStyle}`}
                >
                  {activeProfile.badgeText}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {activeProfile.name} · {activeProfile.location}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Cerrar panel de alerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-alert tabs switcher (allows jumping between active anomalies) */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/80 dark:bg-bia-navy-950/60 border-b border-slate-200/80 dark:border-white/[0.05] flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
            <SlidersHorizontal className="w-3 h-3 text-teal-600 dark:text-bia-turquoise" />
            Incidencias:
          </span>
          {[
            { id: 'M-109', label: 'M-109 (Sobrecarga +110%)', critical: true },
            { id: 'M-112', label: 'M-112 (Sensor Fallo)', critical: false },
            { id: 'M-104', label: 'M-104 (Línea Nueva)', critical: false },
            { id: 'M-106', label: 'M-106 (Caldera Parada)', critical: false },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveMeter(item.id);
                setOperationalChange('no');
                setBaselineUpdated(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeMeter === item.id
                  ? item.critical
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-bia-coral/20 dark:text-bia-coral dark:border-bia-coral/40 font-semibold'
                    : 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-bia-turquoise/20 dark:text-bia-turquoise dark:border-bia-turquoise/40 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-white/[0.02] dark:border-transparent'
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Plain Explanation Card */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
              activeProfile.isCritical
                ? 'bg-gradient-to-b from-bia-coral/[0.08] to-transparent border-bia-coral/25'
                : 'bg-gradient-to-b from-bia-navy-800/60 to-transparent border-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className={`flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider ${
                  activeProfile.isCritical ? 'text-bia-coral' : 'text-bia-turquoise'
                }`}
              >
                {activeProfile.isCritical ? (
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {activeProfile.isCritical
                    ? 'Desvío Crítico en Tiempo Real'
                    : activeProfile.badgeText}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-300 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.08]">
                {activeProfile.deltaTag}
              </span>
            </div>

            <h3 className="text-base font-bold text-white leading-snug">
              {activeProfile.bannerTitle}
            </h3>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
              {activeProfile.explanation}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAskAI({
                    type: 'meter',
                    id: activeMeter,
                    title: `${activeProfile.name} (${activeProfile.deltaTag})`,
                    description: activeProfile.explanation,
                    data: {
                      meterId: activeMeter,
                      anomalyId: activeAnomaly.id,
                      change: activeProfile.deltaTag,
                    },
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bia-turquoise/15 hover:bg-bia-turquoise/25 text-bia-turquoise font-semibold text-xs border border-bia-turquoise/35 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Preguntar a la IA sobre {activeMeter}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToInvestigation(activeAnomaly.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.05] text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Ver expediente de auditoría</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Human-in-the-Loop Assessment */}
          <div className="rounded-2xl bg-bia-navy-850/90 border border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-bia-turquoise shrink-0" />
                <span>{activeProfile.question}</span>
              </p>
              <p className="text-xs text-slate-400 pl-6 leading-relaxed">
                {activeProfile.questionHint}
              </p>
            </div>

            {/* Selection Options */}
            <div className="grid grid-cols-1 gap-2.5 pl-0 sm:pl-6">
              <button
                type="button"
                onClick={() => setOperationalChange('no')}
                className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-start gap-3 cursor-pointer ${
                  operationalChange === 'no'
                    ? activeProfile.isCritical
                      ? 'bg-bia-coral/15 border-bia-coral text-white shadow-sm shadow-bia-coral/15'
                      : 'bg-white/[0.06] border-white/20 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                    operationalChange === 'no'
                      ? activeProfile.isCritical
                        ? 'border-bia-coral bg-bia-coral'
                        : 'border-slate-300 bg-slate-300'
                      : 'border-slate-500'
                  }`}
                >
                  {operationalChange === 'no' && (
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeProfile.isCritical ? 'bg-white' : 'bg-bia-navy-950'
                      }`}
                    />
                  )}
                </div>
                <div>
                  <p
                    className={`font-semibold ${
                      activeProfile.isCritical ? 'text-bia-coral' : 'text-slate-200'
                    }`}
                  >
                    {activeProfile.optionNoTitle}
                  </p>
                  <p className="text-[11px] text-slate-300 font-normal mt-0.5 leading-relaxed">
                    {activeProfile.optionNoDesc}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOperationalChange('yes')}
                className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all flex items-start gap-3 cursor-pointer ${
                  operationalChange === 'yes'
                    ? 'bg-bia-turquoise/15 border-bia-turquoise text-white shadow-sm shadow-bia-turquoise/15'
                    : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                    operationalChange === 'yes'
                      ? 'border-bia-turquoise bg-bia-turquoise'
                      : 'border-slate-500'
                  }`}
                >
                  {operationalChange === 'yes' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-bia-navy-950" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{activeProfile.optionYesTitle}</p>
                  <p className="text-[11px] text-slate-300 font-normal mt-0.5 leading-relaxed">
                    {activeProfile.optionYesDesc}
                  </p>
                </div>
              </button>
            </div>

            {/* Dynamic Recommendation Block */}
            <div className="pl-0 sm:pl-6 pt-1">
              {operationalChange === 'no' ? (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-3 animate-in fade-in duration-150 ${
                    activeProfile.isCritical
                      ? 'bg-bia-coral/[0.08] border-bia-coral/30'
                      : 'bg-white/[0.03] border-white/[0.08]'
                  }`}
                >
                  <p className="text-slate-200 leading-relaxed font-normal">
                    {activeProfile.riskWarning}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onRequestTechnicalVisit(activeMeter)}
                      className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                        activeProfile.isCritical
                          ? 'bg-bia-coral hover:bg-rose-500 shadow-bia-coral/25 hover:shadow-bia-coral/40'
                          : 'bg-bia-navy-750 hover:bg-bia-navy-700 border border-white/[0.1]'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Solicitar Visita Técnica Preventiva</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Respuesta en &lt; 2h por especialistas Bia
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-bia-turquoise/[0.08] border border-bia-turquoise/25 text-xs space-y-3 animate-in fade-in duration-150">
                  <p className="text-slate-200 leading-relaxed font-normal">
                    {activeProfile.rebaselineAction}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleUpdateBaseline}
                      className="px-4 py-2 rounded-xl bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 font-bold text-xs shadow-sm transition-all cursor-pointer"
                    >
                      Registrar nuevo perfil de consumo
                    </button>
                    {baselineUpdated && (
                      <span className="text-xs text-bia-turquoise font-mono flex items-center gap-1 animate-in fade-in">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Perfil actualizado para {activeMeter}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quantitative Electrical Evidence */}
          <div className="rounded-2xl bg-bia-navy-850/80 border border-white/[0.06] p-4 sm:p-5 space-y-3 shadow-sm">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 font-mono uppercase tracking-wider text-[11px]">
                <Activity className="w-3.5 h-3.5 text-bia-turquoise" />
                <span>Evidencia Cuantitativa de Telemetría</span>
              </span>
              <span className="text-slate-400 flex items-center gap-1 font-mono text-[10px]">
                {showTechnicalDetails ? 'Ocultar' : 'Ver detalle'}
                {showTechnicalDetails ? (
                  <ChevronUp className="w-3.5 h-3.5 text-bia-turquoise" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-bia-turquoise" />
                )}
              </span>
            </button>

            {showTechnicalDetails && (
              <div className="pt-2 space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] text-slate-400 uppercase">Consumo Diario</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {activeProfile.dailyKwh}
                    </p>
                    <p
                      className={`text-[10px] font-semibold ${
                        activeProfile.isKwhDeltaAlert ? 'text-bia-coral' : 'text-slate-300'
                      }`}
                    >
                      {activeProfile.dailyKwhDelta}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] text-slate-400 uppercase">
                      {activeProfile.metric2Label}
                    </p>
                    <p
                      className={`text-base font-bold mt-0.5 ${
                        activeProfile.isMetric2Alert ? 'text-bia-coral' : 'text-white'
                      }`}
                    >
                      {activeProfile.metric2Value}
                    </p>
                    <p
                      className={`text-[10px] font-semibold ${
                        activeProfile.isMetric2Alert ? 'text-bia-coral' : 'text-slate-300'
                      }`}
                    >
                      {activeProfile.metric2Delta}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] text-slate-400 uppercase">Factor de Potencia</p>
                    <p
                      className={`text-base font-bold mt-0.5 ${
                        activeProfile.isPfAlert ? 'text-bia-amber' : 'text-white'
                      }`}
                    >
                      {activeProfile.powerFactor}
                    </p>
                    <p
                      className={`text-[10px] font-semibold ${
                        activeProfile.isPfAlert ? 'text-bia-amber' : 'text-slate-300'
                      }`}
                    >
                      {activeProfile.pfDelta}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[10px] text-slate-400 uppercase">Z-Score Robusto</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {activeProfile.zScore}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {activeProfile.zScoreDesc}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1">
                  <strong>Validación física:</strong> {activeProfile.physicalValidation}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-bia-navy-850 shrink-0 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateToMeter(activeMeter);
            }}
            className="text-slate-400 hover:text-slate-200 font-mono transition-colors cursor-pointer"
          >
            Ver medidor {activeMeter} en detalle →
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};
