import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MeterDetailDTO } from '../types/meter';
import { ReadingDTO } from '../types/reading';
import { AnomalyDTO } from '../types/anomaly';
import { api } from '../api/client';
import { sanitizeMeterId, getMeterDisplayName } from '../lib/utils';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { TremorTracker, TrackerBlock } from '../components/tremor/TremorTracker';
import { AskAIButton } from '../components/common/AskAIButton';
import { CopilotContext } from '../components/copilot/AICopilotDrawer';
import {
  ArrowLeft,
  Zap,
  Activity,
  ShieldAlert,
  Wrench,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  FileText,
  ChevronRight,
} from 'lucide-react';

interface MeterDetailViewProps {
  meterId: string;
  onBack: () => void;
  onInvestigateAnomaly?: (anomalyId: string) => void;
  onRunAnalysis?: () => void;
  onAskAI?: (context: CopilotContext) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
  onAnalysisComplete?: () => void;
}

// 14-day telemetry generator ensuring rich charts even before/without server connectivity
function generateTelemetryReadings(meterId: string): ReadingDTO[] {
  const readings: ReadingDTO[] = [];
  const baseDate = new Date('2026-09-01T00:00:00');

  for (let i = 0; i < 336; i++) {
    const d = new Date(baseDate.getTime() + i * 3600 * 1000);
    const ts = d.toISOString();
    const day = Math.floor(i / 24) + 1;
    const hour = i % 24;

    const diurnalFactor = 0.8 + 0.4 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
    let expectedKwh = 106 * diurnalFactor;
    let consumptionKwh = expectedKwh * (0.97 + 0.05 * Math.sin(i * 0.4));
    let voltage = 220 + 2 * Math.cos(i * 0.3);
    let current = (consumptionKwh * 1000) / (voltage * 0.94 * 1.732);
    let pf = 0.94;
    let status = 'OK';

    if (meterId === 'M-109') {
      expectedKwh = 106 * diurnalFactor;
      if (day >= 12 && (day > 12 || hour >= 14)) {
        consumptionKwh = expectedKwh * 2.107;
        current = 424 * (0.96 + 0.08 * Math.sin(i * 0.2));
        voltage = 219.5 + 1.5 * Math.sin(i * 0.1);
        pf = 0.74;
        status = 'ALERT';
      } else {
        consumptionKwh = expectedKwh * (0.98 + 0.04 * Math.sin(i * 0.4));
        current = 201 * (0.96 + 0.08 * Math.sin(i * 0.2));
      }
    } else if (meterId === 'M-104') {
      expectedKwh = 70 * diurnalFactor;
      if (day >= 11) {
        consumptionKwh = expectedKwh * 1.475;
        current = 198 * (0.96 + 0.08 * Math.sin(i * 0.2));
        status = 'ALERT';
      } else {
        consumptionKwh = expectedKwh * (0.98 + 0.04 * Math.sin(i * 0.4));
        current = 135 * (0.96 + 0.08 * Math.sin(i * 0.2));
      }
    } else if (meterId === 'M-106') {
      expectedKwh = 85 * diurnalFactor;
      if (day === 8 && hour >= 6 && hour <= 18) {
        consumptionKwh = 0.4;
        current = 0;
        status = 'ALERT';
      } else {
        consumptionKwh = expectedKwh * (0.98 + 0.04 * Math.sin(i * 0.4));
        current = 160 * (0.96 + 0.08 * Math.sin(i * 0.2));
      }
    } else if (meterId === 'M-112') {
      expectedKwh = 50 * diurnalFactor;
      if (day >= 13) {
        consumptionKwh = 50;
        voltage = 220 + 20 * Math.sin(i * 1.8);
        current = 95 + 18 * Math.cos(i * 2.2);
        pf = 0.82 + 0.1 * Math.sin(i * 0.8);
        status = 'ALERT';
      } else {
        consumptionKwh = expectedKwh * (0.98 + 0.04 * Math.sin(i * 0.4));
        current = 95;
      }
    } else {
      expectedKwh = 35 * diurnalFactor;
      consumptionKwh = expectedKwh * (0.98 + 0.04 * Math.sin(i * 0.5));
      current = 65;
    }

    readings.push({
      timestamp: ts,
      consumption_kwh: Math.round(consumptionKwh * 10) / 10,
      expected_kwh: Math.round(expectedKwh * 10) / 10,
      voltage_v: Math.round(voltage * 10) / 10,
      current_a: Math.round(current * 10) / 10,
      power_factor: Math.round(pf * 100) / 100,
      status,
    });
  }

  return readings;
}

// AI Diagnostic findings dictionary covering all 12 industrial meters
interface MeterDiagnostic {
  anomalia: {
    badge: string;
    type: string;
    typeLabel?: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    severityLabel?: string;
    title: string;
    confidence: number;
    variation: string;
    signals: string[];
    window: string;
    anomalyRange: { start: string; end: string } | null;
  };
  explicacion: {
    tag?: string;
    title: string;
    description: string;
    impactLabel?: string;
    physicalValidation: string;
    plantLog: string;
    electricalMetrics: { current: string; pf: string; voltage: string };
    technicalDetails?: string;
  };
  accion: {
    title: string;
    recommendation: string;
    steps: string[];
    isCritical: boolean;
    showTechnicalVisit: boolean;
  };
}

const meterAIDiagnostics: Record<string, MeterDiagnostic> = {
  'M-109': {
    anomalia: {
      badge: 'Alerta Crítica',
      type: 'REAL_ANOMALY',
      typeLabel: 'Consumo Real No Justificado',
      severity: 'HIGH',
      severityLabel: 'Crítica',
      title: 'Sobrecarga Crítica Sostenida (+110.7%)',
      confidence: 95,
      variation: '+110.7% vs habitual',
      signals: [
        'Consumo al doble de lo habitual (+110.7% continuo)',
        'Corriente eléctrica duplicada: 424 A (lo normal es 201 A)',
        'Baja eficiencia eléctrica: FP 0.74 (energía desaprovechada con recargo)',
      ],
      window: '2026-09-12 14:00 — 2026-09-14 23:00 (Sostenida)',
      anomalyRange: { start: '2026-09-12T14:00:00', end: '2026-09-14T23:00:00' },
    },
    explicacion: {
      tag: 'Diagnóstico Claro',
      title: 'Consumo duplicado (+110%) sin justificación en planta',
      description:
        'La subestación principal está consumiendo más del doble de energía habitual (+110.7%) de forma continua. La IA confirmó que las máquinas realmente consumieron esta electricidad (no es un error del medidor ni del sensor) y no hay turnos extra ni producción programada en la bitácora que justifique este gasto adicional.',
      impactLabel: '¿Por qué es importante? / Impacto en la operación:',
      physicalValidation:
        'Consumo real en planta: Al circular más del doble de corriente de lo normal, los cables y tableros sufren sobrecalentamiento, aumentando el riesgo de un corte eléctrico y elevando fuertemente el valor de tu próxima factura.',
      plantLog: 'Sin registro de turnos ni trabajos autorizados en la bitácora.',
      electricalMetrics: {
        current: '424 A (Doble de lo habitual: 201 A)',
        pf: '0.74 (Baja eficiencia: genera sobrecosto)',
        voltage: '219.5 V (Red estable)',
      },
      technicalDetails:
        'Validación física: P ≈ √3 · V · I · FP comprobada. Demuestra flujo real en el transformador 1 con corriente I=424 A (+110.5%) y pérdidas Joule severas (I²R). Desfase inductivo con caída de factor de potencia a 0.74.',
    },
    accion: {
      title: 'Inspección física y revisión de tableros',
      recommendation:
        'Inspección prioritaria en tableros y transformador para descartar sobrecalentamiento y ubicar qué maquinaria está consumiendo energía de más.',
      steps: [
        'Revisar tableros y cables principales con cámara térmica (termografía) para detectar puntos calientes y evitar riesgos de incendio.',
        'Verificar circuitos para identificar qué maquinaria o equipos pesados quedaron encendidos fuera de turno.',
        'Revisar el banco de condensadores para restablecer la eficiencia (FP a 0.94) y eliminar recargos por energía reactiva en tu factura.',
      ],
      isCritical: true,
      showTechnicalVisit: true,
    },
  },
  'M-112': {
    anomalia: {
      badge: 'Calidad de Datos',
      type: 'DATA_QUALITY',
      typeLabel: 'Problema en Sensor de Medición',
      severity: 'MEDIUM',
      severityLabel: 'Media',
      title: 'Falla de Lectura en Sensor de Medición',
      confidence: 92,
      variation: '-0.4% plano artificial',
      signals: [
        'Lectura de consumo congelada en 50.0 kWh (inmóvil)',
        'Señal de voltaje oscilando de forma errática (±20V)',
        'Las máquinas operan con normalidad en planta',
      ],
      window: '2026-09-13 00:00 — 2026-09-14 23:00',
      anomalyRange: { start: '2026-09-13T00:00:00', end: '2026-09-14T23:00:00' },
    },
    explicacion: {
      tag: 'Diagnóstico del Sensor',
      title: 'Falla exclusiva del sensor (Tus máquinas operan normal)',
      description:
        'El medidor reporta valores congelados e inestables durante 16 horas continuas. La IA comprobó que tus máquinas de moldeo e inyección están trabajando bien; el problema está únicamente en el sensor o equipo de medición que envía los datos a la plataforma.',
      impactLabel: 'Impacto y Diagnóstico:',
      physicalValidation:
        'Falsa alarma de sobreconsumo: No hay peligro en tus equipos ni sobreconsumo real. Se trata de un error de lectura del sensor que debe recalibrarse para mantener tus reportes y costos exactos.',
      plantLog: 'Bitácora reporta: "Lecturas intermitentes en equipo de medida".',
      electricalMetrics: {
        current: '95 A (Señal inestable del sensor)',
        pf: '0.82 (Ruido en lectura)',
        voltage: '220 ± 20 V (Falla de lectura)',
      },
      technicalDetails:
        'Deriva en transductores de corriente (TCs) y gateway Modbus. Ruptura de la ecuación de potencia activa P frente a V·I·FP aparente.',
    },
    accion: {
      title: 'Recalibración y ajuste del sensor de telemetría',
      recommendation:
        'Revisar las conexiones y recalibrar el sensor del medidor M-112 para restaurar datos confiables.',
      steps: [
        'Reiniciar el equipo de telemetría y contrastar con la pantalla física del medidor.',
        'Revisar cables y conexiones del sensor de medición.',
        'Validar la calibración del equipo para eliminar el desfase en las lecturas.',
      ],
      isCritical: false,
      showTechnicalVisit: true,
    },
  },
  'M-104': {
    anomalia: {
      badge: 'Cambio Justificado',
      type: 'EXPLAINABLE_ANOMALY',
      typeLabel: 'Aumento Operativo Planificado',
      severity: 'LOW',
      severityLabel: 'Baja / Informativa',
      title: 'Aumento Justificado por Nueva Línea (+47.5%)',
      confidence: 94,
      variation: '+47.5% vs anterior',
      signals: [
        'Incremento constante de +47.5% desde el 11 de septiembre',
        'Red eléctrica estable, balanceada y segura',
        'Total coincidencia con la bitácora de producción',
      ],
      window: '2026-09-11 00:00 — Actualidad',
      anomalyRange: { start: '2026-09-11T00:00:00', end: '2026-09-14T23:00:00' },
    },
    explicacion: {
      tag: 'Causa Identificada',
      title: 'Aumento justificado por nueva línea de producción',
      description:
        'El consumo subió un 47.5% de forma constante debido al encendido de la nueva línea de envasado registrada en la bitácora de planta. Las mediciones eléctricas son completamente estables y seguras dentro de lo previsto.',
      impactLabel: 'Evaluación de la Operación:',
      physicalValidation:
        'Consumo productivo normal: El gasto extra refleja trabajo productivo real y planificado. No existen fallas ni riesgos para la instalación.',
      plantLog: 'Bitácora reporta: "Nueva línea de producción activada (11-SEP)".',
      electricalMetrics: {
        current: '198 A (Carga adecuada para la nueva línea)',
        pf: '0.94 (Excelente eficiencia energética)',
        voltage: '220.0 V (Red estable)',
      },
      technicalDetails:
        'Operación regular en régimen nominal. Tensión trifásica equilibrada y factor de potencia nominal de 0.94 dentro de capacidad.',
    },
    accion: {
      title: 'Actualizar consumo habitual (Línea Base) y archivar',
      recommendation:
        'Actualizar el consumo de referencia del medidor M-104 para incorporar la nueva producción y evitar falsas alertas.',
      steps: [
        'Guardar el nuevo nivel de consumo en la plataforma (3.420 kWh/día).',
        'Archivar la alerta como cambio operativo legítimo y planificado.',
      ],
      isCritical: false,
      showTechnicalVisit: false,
    },
  },
  'M-106': {
    anomalia: {
      badge: 'Mantenimiento Programado',
      type: 'EXPLAINABLE_ANOMALY',
      typeLabel: 'Mantenimiento Planificado',
      severity: 'LOW',
      severityLabel: 'Baja / Informativa',
      title: 'Parada Programada de Caldera (-99.5% por 12h)',
      confidence: 98,
      variation: '-99.5% durante parada',
      signals: [
        'Consumo en cero durante la ventana de parada',
        'Duración exacta de 12 horas conforme a lo programado',
        'Reanudación normal del servicio al finalizar',
      ],
      window: '2026-09-08 06:00 — 2026-09-08 18:00',
      anomalyRange: { start: '2026-09-08T06:00:00', end: '2026-09-08T18:00:00' },
    },
    explicacion: {
      tag: 'Mantenimiento Confirmado',
      title: 'Mantenimiento preventivo completado con éxito',
      description:
        'El consumo se detuvo durante 12 horas debido a la parada programada para mantenimiento preventivo de la caldera. La telemetría y el consumo se normalizaron automáticamente al terminar los trabajos.',
      impactLabel: 'Evaluación de la Operación:',
      physicalValidation:
        'Operación planificada: La caída temporal de energía coincidió al 100% con los horarios establecidos por el equipo de mantenimiento de la planta.',
      plantLog: 'Bitácora reporta: "Mantenimiento preventivo programado (12 horas)".',
      electricalMetrics: {
        current: '0 A (En mantenimiento programado)',
        pf: '0.94 (Nominal al reanudar)',
        voltage: '220.0 V (Red estable)',
      },
      technicalDetails:
        'Apertura de interruptor de potencia en caldera. Ausencia de corriente primaria con tensión de barraje intacta.',
    },
    accion: {
      title: 'Registrar y archivar orden de mantenimiento',
      recommendation:
        'No se requiere acción técnica correctiva. El sistema operó exactamente conforme a lo programado.',
      steps: [
        'Confirmar el cierre del trabajo en la bitácora de mantenimiento.',
        'Continuar con el monitoreo rutinario.',
      ],
      isCritical: false,
      showTechnicalVisit: false,
    },
  },
};

// Fallback generator for nominal meters (M-101, M-102, M-103, M-105, M-107, M-108, M-110, M-111)
function getNominalDiagnostic(meterId: string, variationPct: number): MeterDiagnostic {
  return {
    anomalia: {
      badge: 'Operación Nominal',
      type: 'NOMINAL',
      typeLabel: 'Operación Normal',
      severity: 'NONE',
      severityLabel: 'Normal',
      title: 'Consumo y Operación Dentro de Parámetros Normales',
      confidence: 99,
      variation: `${variationPct > 0 ? '+' : ''}${variationPct.toFixed(1)}% vs habitual`,
      signals: [
        'Consumo dentro del rango habitual esperado',
        'Red eléctrica estable, balanceada y segura',
        'Alta eficiencia energética sin desperdicio',
      ],
      window: 'Últimas 336 horas (14 días continuos)',
      anomalyRange: null,
    },
    explicacion: {
      tag: 'Operación Estable',
      title: 'Operación normal dentro de los parámetros esperados',
      description: `El medidor ${meterId} opera con total estabilidad. El consumo sigue el ritmo habitual de trabajo de los últimos 14 días sin sobrecargas, cortes ni anomalías en los sensores.`,
      impactLabel: 'Estado del Sistema:',
      physicalValidation:
        'Instalación eficiente y segura: No se detectan anomalías ni riesgos para los equipos ni para la factura eléctrica.',
      plantLog: 'Operación normal sin incidencias reportadas.',
      electricalMetrics: {
        current: 'Normal y balanceada',
        pf: '0.94 (Alta eficiencia)',
        voltage: '220.0 V (Estable)',
      },
      technicalDetails:
        'Parámetros eléctricos dentro de tolerancia nominal calibrada (±3% MAD sobre demanda horaria de 7 días).',
    },
    accion: {
      title: 'Continuar con el monitoreo automático continuo',
      recommendation:
        'Continuar con la supervisión automática habitual. No se requiere intervención correctiva ni preventiva.',
      steps: [
        'Mantener supervisión en tiempo real con muestreo horario.',
        'Revisión rutinaria en el próximo ciclo de mantenimiento preventivo.',
      ],
      isCritical: false,
      showTechnicalVisit: false,
    },
  };
}

export const MeterDetailView: React.FC<MeterDetailViewProps> = ({
  meterId: rawMeterId,
  onBack,
  onInvestigateAnomaly,
  onAskAI,
  onRequestTechnicalVisit,
  onAnalysisComplete,
}) => {
  // Sanitize meterId so 'production-summary' is never used as an ID
  const meterId = sanitizeMeterId(rawMeterId, 'M-109');

  const [meter, setMeter] = useState<MeterDetailDTO | null>(null);
  const [readings, setReadings] = useState<ReadingDTO[]>(() => generateTelemetryReadings(meterId));
  const [_loading, setLoading] = useState(true);
  const [persistedAnomaly, setPersistedAnomaly] = useState<AnomalyDTO | null>(null);

  const [hasRunIA, setHasRunIA] = useState(false);
  const [isRunningIA, setIsRunningIA] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(1);

  // Sanitized display name for meter ensuring 'production-summary' never appears
  const meterDisplayName = useMemo(() => {
    return getMeterDisplayName(meterId, meter?.name);
  }, [meter?.name, meterId]);

  // Synchronize persisted anomaly and telemetry when meterId changes
  useEffect(() => {
    setHasRunIA(false);
    setIsRunningIA(false);
    setPipelineStep(1);
    setPersistedAnomaly(null);
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    let isCurrent = true;
    setLoading(true);

    Promise.all([
      api.getMeter(meterId).catch(() => null),
      api.getMeterReadings(meterId).catch(() => ({ data: [] })),
      api.getAnomalies({ meter_id: meterId }).catch(() => ({ data: [] })),
    ])
      .then(([meterData, readingsData, anomaliesData]) => {
        if (!isCurrent) return;
        if (meterData) {
          setMeter(meterData);
        }
        if (readingsData && readingsData.data && readingsData.data.length > 0) {
          setReadings(readingsData.data);
        } else {
          setReadings(generateTelemetryReadings(meterId));
        }
        if (anomaliesData && anomaliesData.data && anomaliesData.data.length > 0) {
          const activeAnomaly = anomaliesData.data.find((a) => a.status !== 'RESOLVED') || anomaliesData.data[0];
          setPersistedAnomaly(activeAnomaly);
          setHasRunIA(true);
        } else {
          setPersistedAnomaly(null);
          setHasRunIA(false);
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    const handleGlobalAnalysisCompleted = () => {
      Promise.all([
        api.getMeter(meterId).catch(() => null),
        api.getAnomalies({ meter_id: meterId }).catch(() => ({ data: [] })),
      ]).then(([meterResp, anomResp]) => {
        if (!isCurrent) return;
        if (meterResp) {
          setMeter(meterResp);
        }
        if (anomResp && anomResp.data && anomResp.data.length > 0) {
          const active = anomResp.data.find((a) => a.status !== 'RESOLVED') || anomResp.data[0];
          setPersistedAnomaly(active);
          setHasRunIA(true);
        } else {
          setPersistedAnomaly(null);
          setHasRunIA(false);
        }
      });
    };
    window.addEventListener('bia:analysis-completed', handleGlobalAnalysisCompleted);

    return () => {
      isCurrent = false;
      window.removeEventListener('bia:analysis-completed', handleGlobalAnalysisCompleted);
    };
  }, [meterId]);

  // Compute 24h baseline averages
  const hourlyBaseline24h = useMemo(() => {
    if (meter?.baseline?.hourly_kwh && meter.baseline.hourly_kwh.length === 24) {
      return meter.baseline.hourly_kwh;
    }
    const sums = Array(24).fill(0);
    const counts = Array(24).fill(0);
    const calibrationReadings = readings.slice(0, 168);

    for (const r of calibrationReadings) {
      const hour = new Date(r.timestamp).getHours();
      sums[hour] += r.expected_kwh;
      counts[hour] += 1;
    }

    return sums.map((s, h) => Math.round(s / (counts[h] || 1)));
  }, [readings, meter]);

  const dailyBaselineTotal = useMemo(
    () => hourlyBaseline24h.reduce((a, b) => a + b, 0),
    [hourlyBaseline24h]
  );

  const variation = meter?.metrics?.variation_pct ?? 0;

  // Meter status & severity matching the real backend data
  const meterStatus = meter?.status ?? 'OK';
  const meterSeverity = meter?.metrics?.top_severity ?? 'NONE';
  const hasActiveAnomaly = Boolean(persistedAnomaly && persistedAnomaly.status !== 'RESOLVED');
  const isCritical = hasActiveAnomaly && (meterStatus === 'CRITICAL' || meterSeverity === 'HIGH' || persistedAnomaly?.severity === 'HIGH' || persistedAnomaly?.severity === 'CRITICAL');

  // Diagnostic definition for this specific meter: consumes persisted anomaly from API (live Gemini/IA explanation)
  const diagnostic = useMemo((): MeterDiagnostic => {
    // Si la demo fue reseteada o no hay anomalía persistida en backend, mostrar diagnóstico nominal limpio
    if (!persistedAnomaly) {
      return getNominalDiagnostic(meterId, 0);
    }
    const fallback = meterAIDiagnostics[meterId] || getNominalDiagnostic(meterId, variation);

    const formatTypeLabel = (type: string) => {
      switch (type) {
        case 'REAL_ANOMALY': return 'Consumo Real No Justificado';
        case 'DATA_QUALITY': return 'Problema en Sensor de Medición';
        case 'EXPLAINABLE_ANOMALY': return 'Aumento Operativo Planificado';
        case 'FALSE_POSITIVE': return 'Falso Positivo / Operación Justificada';
        default: return type;
      }
    };

    const formatSeverityLabel = (sev: string) => {
      switch (sev) {
        case 'HIGH': return 'Crítica';
        case 'MEDIUM': return 'Media';
        case 'LOW': return 'Baja / Informativa';
        default: return sev;
      }
    };

    const formatBadgeLabel = (type: string, sev: string) => {
      if (persistedAnomaly.status === 'RESOLVED') return 'Anomalía Resuelta';
      if (sev === 'HIGH') return 'Alerta Crítica';
      if (type === 'DATA_QUALITY') return 'Calidad de Datos';
      if (type === 'EXPLAINABLE_ANOMALY') return 'Cambio Justificado';
      if (type === 'FALSE_POSITIVE') return 'Operación Justificada';
      return 'Anomalía Detectada';
    };

    const formatTimeWindow = (startStr: string, endStr: string) => {
      try {
        const s = startStr ? startStr.slice(0, 16).replace('T', ' ') : '';
        const e = endStr ? endStr.slice(0, 16).replace('T', ' ') : '';
        return s && e ? `${s} — ${e}` : fallback.anomalia.window;
      } catch {
        return fallback.anomalia.window;
      }
    };

    let currentMetric = fallback.explicacion.electricalMetrics.current;
    let pfMetric = fallback.explicacion.electricalMetrics.pf;
    let voltageMetric = fallback.explicacion.electricalMetrics.voltage;

    if (persistedAnomaly.evidence && persistedAnomaly.evidence.length > 0) {
      for (const ev of persistedAnomaly.evidence) {
        const m = (ev.metric || '').toLowerCase();
        const obs = Number(ev.observed);
        const dev = Number(ev.deviation_pct);
        if (m.includes('current') || m.includes('corriente')) {
          if (isFinite(obs) && isFinite(dev)) {
            currentMetric = `${obs.toFixed(0)} A (${dev >= 0 ? '+' : ''}${dev.toFixed(0)}% vs baseline)`;
          }
        } else if (m.includes('power_factor') || m.includes('factor')) {
          if (isFinite(obs)) {
            pfMetric = `${obs.toFixed(2)} (${isFinite(dev) && dev < 0 ? 'Baja eficiencia' : 'Nominal'})`;
          }
        } else if (m.includes('voltage') || m.includes('voltaje')) {
          if (isFinite(obs)) {
            voltageMetric = `${obs.toFixed(1)} V`;
          }
        }
      }
    }

    const plantLog = persistedAnomaly.related_event?.description
      ? `Bitácora reporta: "${persistedAnomaly.related_event.description}"`
      : fallback.explicacion.plantLog;

    const explanationTitle = persistedAnomaly.type === 'REAL_ANOMALY'
      ? (fallback.explicacion.title || 'Consumo duplicado sin justificación en planta')
      : persistedAnomaly.type === 'DATA_QUALITY'
      ? (fallback.explicacion.title || 'Falla de lectura exclusiva del sensor de telemetría')
      : (fallback.explicacion.title || 'Evento operativo registrado y verificado');

    const steps = persistedAnomaly.investigation_steps && persistedAnomaly.investigation_steps.length > 0
      ? persistedAnomaly.investigation_steps
      : fallback.accion.steps;

    const signals = persistedAnomaly.signals && persistedAnomaly.signals.length > 0
      ? persistedAnomaly.signals
      : fallback.anomalia.signals;

    const normalizedConfidence = persistedAnomaly.confidence != null
      ? (persistedAnomaly.confidence <= 1 ? Math.round(persistedAnomaly.confidence * 100) : Math.round(persistedAnomaly.confidence))
      : fallback.anomalia.confidence;

    const providerTag = persistedAnomaly.explained_by?.toLowerCase().includes('gemini')
      ? 'IA Gemini en Vivo'
      : persistedAnomaly.explained_by?.toLowerCase().includes('claude')
      ? 'IA Claude en Vivo'
      : 'IA Explicable';

    return {
      anomalia: {
        badge: formatBadgeLabel(persistedAnomaly.type, persistedAnomaly.severity),
        type: persistedAnomaly.type,
        typeLabel: formatTypeLabel(persistedAnomaly.type),
        severity: (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(persistedAnomaly.severity)
          ? persistedAnomaly.severity
          : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',
        severityLabel: formatSeverityLabel(persistedAnomaly.severity),
        title: fallback.anomalia.title || `Anomalía en Medidor ${meterId}`,
        confidence: normalizedConfidence,
        variation: `${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs habitual`,
        signals,
        window: formatTimeWindow(persistedAnomaly.window_start, persistedAnomaly.window_end),
        anomalyRange: persistedAnomaly.window_start && persistedAnomaly.window_end
          ? { start: persistedAnomaly.window_start, end: persistedAnomaly.window_end }
          : fallback.anomalia.anomalyRange,
      },
      explicacion: {
        tag: providerTag,
        title: explanationTitle,
        description: persistedAnomaly.reason || fallback.explicacion.description,
        impactLabel: fallback.explicacion.impactLabel,
        physicalValidation: fallback.explicacion.physicalValidation,
        plantLog,
        electricalMetrics: {
          current: currentMetric,
          pf: pfMetric,
          voltage: voltageMetric,
        },
        technicalDetails: fallback.explicacion.technicalDetails,
      },
      accion: {
        title: fallback.accion.title,
        recommendation: persistedAnomaly.recommended_action || fallback.accion.recommendation,
        steps,
        isCritical: persistedAnomaly.severity === 'HIGH' || isCritical,
        showTechnicalVisit: persistedAnomaly.severity === 'HIGH' || persistedAnomaly.type === 'DATA_QUALITY' || fallback.accion.showTechnicalVisit,
      },
    };
  }, [meterId, variation, persistedAnomaly, isCritical]);

  const timersRef = useRef<number[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Dynamic tracker blocks computed from actual telemetry readings and detected anomalies
  const meterTracker: TrackerBlock[] = useMemo(() => {
    if (!readings || readings.length === 0) {
      return Array.from({ length: 14 }, (_, i) => ({
        key: i + 1,
        color: (isCritical ? 'rose' : meterStatus === 'ALERT' ? 'amber' : 'emerald') as 'rose' | 'amber' | 'emerald',
        tooltip: `Día ${i + 1}: Sin lecturas telemétricas detalladas`,
      }));
    }

    const sorted = [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const startTime = new Date(sorted[0].timestamp).getTime();
    const dayMap = new Map<number, { count: number; maxDev: number; hasCritical: boolean; hasWarning: boolean }>();

    sorted.forEach((r) => {
      const rTime = new Date(r.timestamp).getTime();
      const dayIndex = Math.min(13, Math.max(0, Math.floor((rTime - startTime) / (24 * 3600 * 1000))));
      const day = dayIndex + 1;
      if (!dayMap.has(day)) {
        dayMap.set(day, { count: 0, maxDev: 0, hasCritical: false, hasWarning: false });
      }
      const entry = dayMap.get(day)!;
      entry.count += 1;
      const expected = r.expected_kwh || 1;
      const dev = Math.abs(r.consumption_kwh - expected) / expected;
      if (dev > entry.maxDev) entry.maxDev = dev;
      if (r.status === 'ANOMALY' || dev >= 0.8) entry.hasCritical = true;
      else if (dev >= 0.35) entry.hasWarning = true;
    });

    const anomalyStart = persistedAnomaly?.window_start ? new Date(persistedAnomaly.window_start).getTime() : 0;
    const anomalyEnd = persistedAnomaly?.window_end ? new Date(persistedAnomaly.window_end).getTime() : 0;

    return Array.from({ length: 14 }, (_, i) => {
      const day = i + 1;
      const data = dayMap.get(day);
      const dayStart = startTime + (day - 1) * 24 * 3600 * 1000;
      const dayEnd = dayStart + 24 * 3600 * 1000;
      const hasAnomalyWindow = anomalyStart > 0 && anomalyEnd > 0 && (dayStart <= anomalyEnd && dayEnd >= anomalyStart);

      if (hasAnomalyWindow && persistedAnomaly?.severity === 'HIGH') {
        return {
          key: day,
          color: 'rose',
          tooltip: `Día ${day}: Anomalía crítica detectada (${persistedAnomaly.type})`,
        };
      }
      if (hasAnomalyWindow && persistedAnomaly?.type === 'DATA_QUALITY') {
        return {
          key: day,
          color: 'purple',
          tooltip: `Día ${day}: Inconsistencia en telemetría / Calidad de Datos`,
        };
      }
      if (hasAnomalyWindow && (persistedAnomaly?.severity === 'MEDIUM' || persistedAnomaly?.type === 'EXPLAINABLE_ANOMALY')) {
        return {
          key: day,
          color: 'amber',
          tooltip: `Día ${day}: Desviación operativa controlada (${persistedAnomaly.type})`,
        };
      }
      if (data?.hasCritical) {
        return {
          key: day,
          color: 'rose',
          tooltip: `Día ${day}: Sobrecarga / desviación crítica (+${(data.maxDev * 100).toFixed(0)}% vs baseline)`,
        };
      }
      if (data?.hasWarning) {
        return {
          key: day,
          color: 'amber',
          tooltip: `Día ${day}: Desviación moderada (+${(data.maxDev * 100).toFixed(0)}% vs baseline)`,
        };
      }
      return {
        key: day,
        color: 'emerald',
        tooltip: `Día ${day}: Operación nominal dentro del baseline`,
      };
    });
  }, [readings, persistedAnomaly, isCritical, meterStatus]);

  // Handle "Run IA Analysis" inside this meter view with real-time backend sync
  const handleRunIAAnalysis = async () => {
    setIsRunningIA(true);
    setPipelineStep(1);

    // Clear any pending timers
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    // Progressive step animations
    const timer1 = window.setTimeout(() => setPipelineStep(2), 350);
    const timer2 = window.setTimeout(() => setPipelineStep(3), 750);
    timersRef.current.push(timer1, timer2);

    try {
      // 1. Trigger the actual backend analysis pipeline
      const initialRun = await api.triggerAnalysis();
      const runId = initialRun.id;

      // 2. Poll until completed or timeout
      const pollStart = Date.now();
      const pollInterval = window.setInterval(async () => {
        try {
          const current = await api.getAnalysisStatus(runId);
          if (
            current.status === 'COMPLETED' ||
            current.status === 'FAILED' ||
            Date.now() - pollStart > 12000
          ) {
            window.clearInterval(pollInterval);
            setIsRunningIA(false);
            setHasRunIA(true);

            // Fetch newly generated anomaly for this meter from API
            api.getAnomalies({ meter_id: meterId })
              .then((anomResp) => {
                if (anomResp && anomResp.data && anomResp.data.length > 0) {
                  const active = anomResp.data.find((a) => a.status !== 'RESOLVED') || anomResp.data[0];
                  setPersistedAnomaly(active);
                }
              })
              .catch(() => {});

            // Notify parent & global event immediately in real time
            onAnalysisComplete?.();
            window.dispatchEvent(new CustomEvent('bia:analysis-completed', { detail: current }));

            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
          }
        } catch {
          window.clearInterval(pollInterval);
          setIsRunningIA(false);
          setHasRunIA(true);
          api.getAnomalies({ meter_id: meterId })
            .then((anomResp) => {
              if (anomResp && anomResp.data && anomResp.data.length > 0) {
                const active = anomResp.data.find((a) => a.status !== 'RESOLVED') || anomResp.data[0];
                setPersistedAnomaly(active);
              }
            })
            .catch(() => {});
          onAnalysisComplete?.();
          window.dispatchEvent(new CustomEvent('bia:analysis-completed'));
        }
      }, 300);

      timersRef.current.push(pollInterval);
    } catch {
      // Offline / fallback completion
      const timer3 = window.setTimeout(() => {
        setIsRunningIA(false);
        setHasRunIA(true);
        api.getAnomalies({ meter_id: meterId })
          .then((anomResp) => {
            if (anomResp && anomResp.data && anomResp.data.length > 0) {
              const active = anomResp.data.find((a) => a.status !== 'RESOLVED') || anomResp.data[0];
              setPersistedAnomaly(active);
            }
          })
          .catch(() => {});
        onAnalysisComplete?.();
        window.dispatchEvent(new CustomEvent('bia:analysis-completed'));
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }, 1200);
      timersRef.current.push(timer3);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Bar: Back to Dashboard & Breadcrumb Navigation & Direct Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-200/70 dark:border-white/[0.05]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shadow-xs dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-200 dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
            <span>Volver al Dashboard</span>
          </button>

          <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">/</span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
            Medidores <ChevronRight className="w-3 h-3 inline text-slate-400 dark:text-slate-500 mx-0.5" />
            <strong className="text-slate-900 dark:text-slate-200">{meterId}</strong>
          </span>
        </div>

        {/* Quick actions in top bar */}
        <div className="flex items-center gap-2.5">
          {/* THE ONLY Run IA Analysis button: Prominent in top bar */}
          {!hasRunIA && !isRunningIA && (
            <button
              onClick={handleRunIAAnalysis}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer animate-pulse"
              title={`Ejecutar análisis multivariable de IA para el medidor ${meterId}`}
            >
              <Play className="w-4 h-4 fill-current text-white dark:text-bia-navy-950" />
              <span>Run IA Analysis</span>
            </button>
          )}

          {isRunningIA && (
            <button
              disabled
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 dark:bg-bia-turquoise/20 dark:text-bia-turquoise dark:border-bia-turquoise/40 text-xs font-mono font-semibold cursor-wait"
            >
              <div className="w-3.5 h-3.5 border-2 border-cyan-600 dark:border-bia-turquoise border-t-transparent rounded-full animate-spin" />
              <span>Analizando IA (Paso {pipelineStep}/3)...</span>
            </button>
          )}

          {hasRunIA && (
            <button
              onClick={handleRunIAAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-300 dark:hover:text-white"
              title="Volver a ejecutar el análisis de IA"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Re-ejecutar IA</span>
            </button>
          )}

          {hasRunIA && persistedAnomaly && onInvestigateAnomaly && (
            <button
              onClick={() => onInvestigateAnomaly(persistedAnomaly.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs dark:bg-bia-turquoise/10 dark:hover:bg-bia-turquoise/20 dark:text-bia-turquoise dark:border-bia-turquoise/30"
              title="Abrir investigación completa de la anomalía"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Investigar Anomalía →</span>
            </button>
          )}

          {onAskAI && (
            <AskAIButton
              label={`Asistente Bia IA · ${meterId}`}
              size="sm"
              onClick={() =>
                onAskAI({
                  type: 'meter',
                  id: meterId,
                  title: `Detalle del Medidor ${meterId}`,
                  description: hasRunIA
                    ? diagnostic.explicacion.description
                    : `Telemetría, consumo actual y baseline del medidor ${meterId}.`,
                  data: {
                    meter_id: meterId,
                    has_ai_run: hasRunIA,
                    diagnostic: hasRunIA ? diagnostic : null,
                    anomaly_id: persistedAnomaly?.id,
                  },
                })
              }
            />
          )}

          {onRequestTechnicalVisit && isCritical && (
            <button
              onClick={() => onRequestTechnicalVisit(meterId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs dark:bg-bia-coral/15 dark:hover:bg-bia-coral/25 dark:text-bia-coral dark:border-bia-coral/30"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Solicitar Visita (2h)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Hero Card: Meter Telemetry Metadata Header */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-xs dark:bg-[#0c101d] dark:border-[#1b243b] transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-sm ${
                  isCritical
                    ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800/60'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-teal-950/70 dark:text-teal-400 dark:border-teal-800/60'
                }`}
              >
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight flex items-center gap-2">
                    Medidor {meterId}
                  </h1>

                  {/* Single Clean Status & Severity Badge - No redundant repetitions */}
                  {isCritical ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800/80">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      CRÍTICO · Severidad Alta
                    </span>
                  ) : meterStatus === 'ALERT' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800/80">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      ALERTA · Severidad Media
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/80 dark:text-teal-400 dark:border-teal-800/80">
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                      NOMINAL · Operación Normal
                    </span>
                  )}

                  {/* AI Status Badge */}
                  {!hasRunIA ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-[#161d31] dark:text-teal-400 dark:border-[#263352]">
                      <Sparkles className="w-3 h-3 text-teal-500 dark:text-teal-400" />
                      <span>IA: Listo</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Diagnóstico IA: Completado</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                  {meterDisplayName} · Telemetría horaria continua de 14 días (336 horas)
                </p>
              </div>
            </div>
          </div>

          {/* Telemetry Metrics Ribbon */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-[#121829] p-4 rounded-xl border border-slate-200/70 dark:border-[#222d4a] text-xs font-mono shadow-xs">
            <div>
              <p className="text-[10px] uppercase font-mono font-medium text-slate-500 dark:text-slate-400">Consumo (24h)</p>
              <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {(meter?.metrics?.current_kwh ?? (meterId === 'M-109' ? 2207.6 : 708)).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kWh</span>
              </p>
            </div>

            <div className="border-l border-slate-200/70 dark:border-[#222d4a] pl-4">
              <p className="text-[10px] uppercase font-mono font-medium text-slate-500 dark:text-slate-400">Baseline Diario</p>
              <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                {(meter?.metrics?.baseline_kwh ?? (meterId === 'M-109' ? 1047.7 : dailyBaselineTotal)).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kWh</span>
              </p>
            </div>

            <div className="border-l border-slate-200/70 dark:border-[#222d4a] pl-4">
              <p className="text-[10px] uppercase font-mono font-medium text-slate-500 dark:text-slate-400">Variación</p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${
                  isCritical
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80'
                    : variation > 15
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80'
                    : 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-400 border border-teal-200 dark:border-teal-800/80'
                }`}>
                  <span>{variation > 0 ? `+${variation.toFixed(1)}%` : `${variation.toFixed(1)}%`}</span>
                </span>
              </div>
            </div>

            <div className="border-l border-slate-200/70 dark:border-[#222d4a] pl-4">
              <p className="text-[10px] uppercase font-mono font-medium text-slate-500 dark:text-slate-400">Muestras</p>
              <p className="text-lg font-bold font-mono text-cyan-600 dark:text-teal-400">
                336 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Horas</span>
              </p>
            </div>
          </div>
        </div>

        {/* 14-Day Health Tracker - High Contrast & Crisp Labels */}
        <div className="pt-4 border-t border-slate-100 dark:border-[#1b243b] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs flex items-center gap-2">
              <span>Registro de Telemetría (14 Días):</span>
              {isCritical && (
                <span className="text-[11px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded dark:text-rose-400 dark:bg-rose-950/80 dark:border-rose-800/70">
                  Sobrecarga detectada en días 12-14 (+110.7%)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Nominal
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Sobrecarga Crítica
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Operacional
              </span>
            </div>
          </div>
          <TremorTracker data={meterTracker} />
        </div>
      </div>

      {/* 3. Loading state if IA is executing */}
      {isRunningIA && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs dark:bg-bia-navy-850/90 dark:border-bia-turquoise/40 backdrop-blur-md animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-cyan-600 dark:border-bia-turquoise border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="text-xs font-mono">
              <span className="text-slate-900 dark:text-white font-bold">Procesando telemetría con IA (Paso {pipelineStep} de 3)...</span>
              <span className="text-slate-500 dark:text-slate-400 ml-2 hidden sm:inline">Evaluando telemetría, física eléctrica y bitácora.</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-bia-turquoise/15 dark:text-bia-turquoise dark:border-bia-turquoise/30 font-semibold shrink-0">
            Paso {pipelineStep}/3
          </span>
        </div>
      )}

      {/* 4. Gráfica Principal: Telemetría Continua de 14 Días (336 Horas) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-600 dark:text-bia-turquoise" />
            <span>Curva de Demanda y Telemetría Eléctrica (14 Días)</span>
          </h2>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.03] px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-white/[0.06]">
            {hasRunIA && diagnostic.anomalia.anomalyRange ? 'Ventana anómala resaltada' : 'Telemetría continua (336h)'}
          </span>
        </div>

        <TimeSeriesChart
          readings={readings}
          anomalyStart={hasRunIA ? diagnostic.anomalia.anomalyRange?.start : undefined}
          anomalyEnd={hasRunIA ? diagnostic.anomalia.anomalyRange?.end : undefined}
          title={`Historial de Telemetría Eléctrica (14 Días) — Medidor ${meterId}`}
        />
      </div>

      {/* 5. Diagnóstico IA Ejecutivo Conciso (1. Anomalía → 2. Causa Física → 3. Acción) - Solo visible tras ejecutar IA */}
      {hasRunIA && persistedAnomaly && (
        <div ref={resultsRef} className="pt-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                <span>Diagnóstico Ejecutivo IA</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunIAAnalysis}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 text-[11px] font-mono transition-all active:scale-95 cursor-pointer shadow-xs dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.08] dark:text-slate-300 dark:hover:text-white"
                  title="Volver a ejecutar el análisis de IA"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-ejecutar</span>
                </button>
              </div>
            </div>

            {/* 3 Concise Cards: 1. Anomalía, 2. Causa Física, 3. Acción */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card 1: Anomalía */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-sm transition-all ${
                  isCritical
                    ? 'bg-white border-rose-200/90 dark:bg-bia-coral/[0.06] dark:border-bia-coral/35'
                    : 'bg-white border-slate-200/80 dark:bg-white/[0.02] dark:border-white/[0.08]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200/80 dark:bg-white/[0.08] dark:text-white dark:border-white/10">
                      1. Anomalía
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-bia-coral/20 dark:text-bia-coral dark:border-bia-coral/40'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                      }`}
                    >
                      {diagnostic.anomalia.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-start gap-1.5">
                      {isCritical ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-bia-coral shrink-0 mt-0.5 animate-pulse" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <span>{diagnostic.anomalia.title}</span>
                    </h4>
                  </div>

                  {/* Bullet points concisos */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] font-mono text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Variación:</span>
                      <span className={isCritical ? 'font-bold text-rose-600 dark:text-bia-coral' : 'font-semibold text-slate-800 dark:text-slate-200'}>
                        {diagnostic.anomalia.variation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] font-mono text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Ventana:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {diagnostic.anomalia.window}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <span>Severidad: <strong className={isCritical ? 'text-rose-600 dark:text-bia-coral' : 'text-slate-700 dark:text-slate-300'}>{diagnostic.anomalia.severityLabel || diagnostic.anomalia.severity}</strong></span>
                  <span className="text-cyan-700 dark:text-bia-turquoise font-semibold">
                    Confianza: {diagnostic.anomalia.confidence}%
                  </span>
                </div>
              </div>

              {/* Card 2: Causa Física */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-between space-y-3 shadow-xs dark:bg-white/[0.02] dark:border-white/[0.08] backdrop-blur-sm">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200/80 dark:bg-white/[0.08] dark:text-white dark:border-white/10">
                      2. Causa Física
                    </span>
                    <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200 font-semibold dark:text-bia-turquoise dark:bg-bia-turquoise/10 dark:border-bia-turquoise/20">
                      {diagnostic.explicacion.tag || 'Física Validada'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-600 dark:text-bia-turquoise shrink-0" />
                      <span>{diagnostic.explicacion.title}</span>
                    </h4>
                  </div>

                  {/* Electrical metrics table compact */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5 text-xs dark:bg-white/[0.02] dark:border-white/[0.05]">
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500">Corriente:</span>{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {diagnostic.explicacion.electricalMetrics.current}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Factor Potencia:</span>{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {diagnostic.explicacion.electricalMetrics.pf}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
                    {diagnostic.explicacion.physicalValidation}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="text-slate-400 dark:text-slate-500">Bitácora: </span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{diagnostic.explicacion.plantLog}</span>
                </div>
              </div>

              {/* Card 3: Acción */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 shadow-xs backdrop-blur-sm ${
                  isCritical
                    ? 'bg-white border-rose-200/90 dark:bg-bia-coral/[0.04] dark:border-bia-coral/30'
                    : 'bg-white border-slate-200/80 dark:bg-white/[0.02] dark:border-white/[0.08]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200/80 dark:bg-white/[0.08] dark:text-white dark:border-white/10">
                      3. Acción
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-bia-coral/15 dark:text-bia-coral dark:border-bia-coral/30'
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/[0.06]'
                      }`}
                    >
                      {isCritical ? 'Intervención Prioritaria' : 'Protocolo Estándar'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-rose-600 dark:text-bia-coral shrink-0" />
                      <span>{diagnostic.accion.recommendation}</span>
                    </h4>
                  </div>

                  {/* 2-3 concise bullets */}
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 font-sans">
                    {diagnostic.accion.steps.slice(0, 2).map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className="text-cyan-600 dark:text-bia-turquoise font-mono font-bold">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Direct Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-2">
                  {diagnostic.accion.showTechnicalVisit && onRequestTechnicalVisit && (
                    <button
                      onClick={() => onRequestTechnicalVisit(meterId)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Solicitar Visita Técnica (2h)</span>
                    </button>
                  )}

                  {persistedAnomaly && onInvestigateAnomaly && (
                    <button
                      onClick={() => onInvestigateAnomaly(persistedAnomaly.id)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:text-slate-300 dark:hover:text-white dark:border-white/[0.06]"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                      <span>Ver Expediente de Investigación →</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeterDetailView;
