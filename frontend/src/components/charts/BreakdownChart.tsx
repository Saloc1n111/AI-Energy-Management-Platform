import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { PieChart } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface BreakdownChartProps {
  byType?: Record<string, number>;
  title?: string;
}

export const BreakdownChart: React.FC<BreakdownChartProps> = ({
  byType = {},
  title = 'Distribución de Anomalías',
}) => {
  const labelsMap: Record<string, { label: string; color: string }> = {
    REAL_ANOMALY: { label: 'Anomalía Real', color: '#FF4D6D' }, // Bia Coral
    DATA_QUALITY: { label: 'Calidad Datos', color: '#8B5CF6' }, // Bia Purple
    EXPLAINABLE_ANOMALY: { label: 'Explicable', color: '#08DDBC' }, // Bia Turquoise
    FALSE_POSITIVE: { label: 'Falso Positivo', color: '#64748B' }, // Slate
  };

  const types = Object.keys(byType);
  const labels = types.map((t) => labelsMap[t]?.label || t);
  const dataValues = types.map((t) => byType[t]);
  const bgColors = types.map((t) => labelsMap[t]?.color || '#64748B');

  const total = dataValues.reduce((a, b) => a + b, 0);

  const data = {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: '#070b22',
        borderWidth: 2,
        hoverOffset: 3,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#94A3B8',
          font: { size: 10, family: 'Inter' },
          boxWidth: 8,
          padding: 8,
        },
      },
      tooltip: {
        backgroundColor: '#070b22',
        borderColor: '#1b265e',
        borderWidth: 1,
        titleColor: '#FFFFFF',
        bodyColor: '#94A3B8',
        padding: 8,
      },
    },
  };

  return (
    <div className="bg-bia-navy-850 p-4 rounded-xl border border-bia-navy-750 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
          <PieChart className="w-3.5 h-3.5 text-bia-turquoise" />
          {title}
        </h4>
        <span className="text-xs font-mono font-bold text-slate-300">
          Total: {total}
        </span>
      </div>

      <div className="relative h-[170px] w-full flex items-center justify-center my-auto">
        {total > 0 ? (
          <>
            <Doughnut data={data} options={options} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
              <span className="text-2xl font-bold text-white font-mono">{total}</span>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Casos</span>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400">Sin datos de clasificación.</div>
        )}
      </div>
    </div>
  );
};
