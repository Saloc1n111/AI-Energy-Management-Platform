import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ReadingDTO } from '../../types/reading';
import { Activity, Eye, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesChartProps {
  readings: ReadingDTO[];
  anomalyStart?: string;
  anomalyEnd?: string;
  title?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  readings = [],
  anomalyStart,
  anomalyEnd,
  title = 'Serie Temporal de Telemetría (14 Días)',
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [showVoltage, setShowVoltage] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPowerFactor, setShowPowerFactor] = useState(false);

  const labels = readings.map((r) => {
    const d = new Date(r.timestamp);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:00`;
  });

  const consumptionData = readings.map((r) => r.consumption_kwh);
  const expectedData = readings.map((r) => r.expected_kwh);
  const voltageData = readings.map((r) => r.voltage_v);
  const currentData = readings.map((r) => r.current_a);
  const pfData = readings.map((r) => r.power_factor);

  const isAnomalous = (ts: string) => {
    if (!anomalyStart) return false;
    const t = new Date(ts).getTime();
    const start = new Date(anomalyStart).getTime();
    const end = anomalyEnd ? new Date(anomalyEnd).getTime() : Infinity;
    return t >= start && t <= end;
  };

  const pointColors = readings.map((r) =>
    isAnomalous(r.timestamp) ? '#FF4D6D' : 'rgba(8, 221, 188, 0.4)'
  );
  const pointRadii = readings.map((r) => (isAnomalous(r.timestamp) ? 3.5 : 0));

  const datasets: any[] = [
    {
      label: 'Consumo Real (kWh)',
      data: consumptionData,
      borderColor: '#08DDBC', // Bia Turquoise
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, 'rgba(8, 221, 188, 0.22)');
        gradient.addColorStop(1, 'rgba(8, 221, 188, 0.00)');
        return gradient;
      },
      fill: true,
      tension: 0.15,
      borderWidth: 2,
      pointBackgroundColor: pointColors,
      pointBorderColor: pointColors,
      pointRadius: pointRadii,
      pointHoverRadius: 5,
      yAxisID: 'y',
    },
    {
      label: 'Baseline Esperado (kWh)',
      data: expectedData,
      borderColor: '#8B5CF6', // Bia Purple
      borderDash: [5, 4],
      fill: false,
      tension: 0.15,
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      yAxisID: 'y',
    },
  ];

  if (showVoltage) {
    datasets.push({
      label: 'Voltaje (V)',
      data: voltageData,
      borderColor: '#FFB703', // Bia Amber
      borderDash: [2, 2],
      tension: 0.15,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'yVoltage',
    });
  }

  if (showCurrent) {
    datasets.push({
      label: 'Corriente (A)',
      data: currentData,
      borderColor: '#C084FC',
      tension: 0.15,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'yCurrent',
    });
  }

  if (showPowerFactor) {
    datasets.push({
      label: 'Factor Potencia (FP)',
      data: pfData,
      borderColor: '#38BDF8',
      tension: 0.15,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: 'yPF',
    });
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? '#CBD5E1' : '#475569',
          font: { size: 10, family: 'Inter', weight: '600' },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 6,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#0c101d' : '#0f172a',
        titleColor: '#FFFFFF',
        bodyColor: isDark ? '#CBD5E1' : '#F1F5F9',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        usePointStyle: true,
      },
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          maxTicksLimit: 14,
          font: { size: 10, family: 'Inter' },
        },
      },
      y: {
        position: 'left',
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: { size: 10, family: 'Inter' },
        },
        title: {
          display: true,
          text: 'Consumo (kWh)',
          color: '#08DDBC',
          font: { size: 10, weight: 'bold' },
        },
      },
      yVoltage: {
        position: 'right',
        display: showVoltage,
        grid: { drawOnChartArea: false },
        ticks: { color: '#FFB703', font: { size: 9 } },
        title: { display: true, text: 'Voltaje (V)', color: '#FFB703', font: { size: 9 } },
      },
      yCurrent: {
        position: 'right',
        display: showCurrent,
        grid: { drawOnChartArea: false },
        ticks: { color: '#C084FC', font: { size: 9 } },
        title: { display: true, text: 'Corriente (A)', color: '#C084FC', font: { size: 9 } },
      },
      yPF: {
        position: 'right',
        display: showPowerFactor,
        grid: { drawOnChartArea: false },
        ticks: { color: '#38BDF8', font: { size: 9 } },
        title: { display: true, text: 'FP', color: '#38BDF8', font: { size: 9 } },
        min: 0,
        max: 1,
      },
    },
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs dark:bg-bia-navy-850/80 dark:border-white/[0.06] p-5 space-y-4 backdrop-blur-sm">
      {/* Header with Title and Multivariable Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div>
          <h3 className="text-xs uppercase font-medium tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 font-mono">
            <Activity className="w-3.5 h-3.5 text-bia-turquoise" />
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Muestreo horario sincronizado con perfil de línea base calibrado (14 días).
          </p>
        </div>

        {/* Telemetry Multi-variable Toggles */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.02] p-1 rounded-xl border border-slate-200 dark:border-white/[0.05] text-xs">
          <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
            <Eye className="w-3 h-3 text-bia-turquoise" />
            Ejes:
          </span>
          <button
            onClick={() => setShowVoltage(!showVoltage)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              showVoltage
                ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-bia-amber/[0.12] dark:text-bia-amber dark:border-bia-amber/30 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
            }`}
          >
            Voltaje (V)
          </button>
          <button
            onClick={() => setShowCurrent(!showCurrent)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              showCurrent
                ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-500/[0.12] dark:text-purple-300 dark:border-purple-500/30 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
            }`}
          >
            Corriente (A)
          </button>
          <button
            onClick={() => setShowPowerFactor(!showPowerFactor)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
              showPowerFactor
                ? 'bg-teal-100 text-teal-900 border border-teal-300 dark:bg-bia-turquoise/[0.12] dark:text-bia-turquoise dark:border-bia-turquoise/30 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
            }`}
          >
            FP
          </button>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="h-[320px] sm:h-[380px] w-full">
        {readings.length > 0 ? (
          <Line data={{ labels, datasets }} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
            Cargando telemetría Bia...
          </div>
        )}
      </div>

      {anomalyStart && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-bia-coral/[0.08] dark:border-bia-coral/25 dark:text-bia-coral font-mono font-medium">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-bia-coral shrink-0" />
          <span>Ventana de Anomalía Crítica Detectada:</span>
          <span>
            Desde {new Date(anomalyStart).toLocaleString()}
          </span>
          {anomalyEnd && (
            <span>
              hasta {new Date(anomalyEnd).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
