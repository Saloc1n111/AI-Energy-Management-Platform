import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Clock } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Baseline24hChartProps {
  hourlyKwh: number[];
  dailyTotal?: number;
  title?: string;
}

export const Baseline24hChart: React.FC<Baseline24hChartProps> = ({
  hourlyKwh = [],
  dailyTotal,
  title = 'Perfil Horario Diario Típico (Baseline 24h)',
}) => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const data = {
    labels,
    datasets: [
      {
        label: 'Consumo Esperado (kWh / h)',
        data: hourlyKwh,
        backgroundColor: 'rgba(8, 221, 188, 0.35)',
        borderColor: '#08DDBC',
        borderWidth: 1.5,
        borderRadius: 3,
        hoverBackgroundColor: 'rgba(8, 221, 188, 0.8)',
        hoverBorderColor: '#08DDBC',
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#070b22',
        titleColor: '#FFFFFF',
        bodyColor: '#CBD5E1',
        borderColor: '#1b265e',
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (ctx: any) => `Esperado: ${ctx.parsed.y} kWh`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(27, 38, 94, 0.4)' },
        ticks: { color: '#8E9BB5', font: { size: 9, family: 'Inter' } },
      },
      y: {
        grid: { color: 'rgba(27, 38, 94, 0.4)' },
        ticks: { color: '#8E9BB5', font: { size: 9, family: 'Inter' } },
        title: {
          display: true,
          text: 'kWh',
          color: '#08DDBC',
          font: { size: 9, weight: 'bold' },
        },
      },
    },
  };

  return (
    <div className="rounded-xl bg-bia-navy-850 border border-bia-navy-750 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-mono">
          <Clock className="w-3.5 h-3.5 text-bia-turquoise" />
          {title}
        </h4>
        {dailyTotal !== undefined && (
          <span className="text-[11px] font-mono font-bold text-bia-turquoise bg-bia-navy-950 px-2 py-0.5 rounded border border-bia-turquoise/30">
            Total Diario: ~{dailyTotal.toLocaleString()} kWh
          </span>
        )}
      </div>

      <div className="h-[200px] w-full">
        {hourlyKwh.length === 24 ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
            Sin perfil horario disponible.
          </div>
        )}
      </div>
    </div>
  );
};
