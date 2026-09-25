import React from 'react';
import { LayoutDashboard, Gauge, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';

export type ViewType = 'dashboard' | 'meters' | 'meter-detail' | 'anomalies' | 'investigation';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, contextId?: string) => void;
  openAnomaliesCount?: number;
  criticalMeterId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  openAnomaliesCount = 4,
  criticalMeterId = 'M-109',
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard General',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: null,
    },
    {
      id: 'meters',
      label: 'Medidores Inteligentes',
      icon: <Gauge className="w-4 h-4" />,
      badge: '12',
    },
    {
      id: 'anomalies',
      label: 'Registro de Anomalías',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: openAnomaliesCount > 0 ? `${openAnomaliesCount}` : null,
      badgeColor: 'bg-bia-coral/15 text-bia-coral border-bia-coral/30',
    },
  ];

  return (
    <aside className="w-60 bg-bia-navy-900 border-r border-bia-navy-750 p-3.5 flex flex-col justify-between shrink-0 hidden md:flex min-h-[calc(100vh-57px)]">
      <div className="space-y-6">
        <div>
          <p className="px-2.5 text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400">
            Navegación
          </p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as ViewType)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-bia-navy-800 text-bia-turquoise border border-bia-navy-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-bia-navy-850'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={active ? 'text-bia-turquoise' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        item.badgeColor || 'bg-bia-navy-950 text-slate-300 border-bia-navy-750'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Priority Monitoring Section */}
        <div className="pt-4 border-t border-bia-navy-750">
          <p className="px-2.5 text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400">
            Unidades en Alerta Crítica
          </p>

          <div className="mt-2 space-y-1.5">
            <button
              onClick={() => onNavigate('meter-detail', criticalMeterId)}
              className="w-full text-left p-2.5 rounded-lg bg-bia-navy-950/80 border border-bia-coral/30 hover:border-bia-coral/60 hover:bg-bia-navy-850 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-bia-coral" />
                  {criticalMeterId}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-bia-coral/15 text-bia-coral border border-bia-coral/30">
                  +110.7%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-snug font-sans">
                Sobrecarga no programada detectada en tiempo real.
              </p>
            </button>

            <button
              onClick={() => onNavigate('investigation', 'anm_m109_20260912T1400')}
              className="w-full text-left p-2.5 rounded-lg bg-bia-navy-950/80 border border-bia-navy-750 hover:border-bia-turquoise/40 hover:bg-bia-navy-850 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-bia-turquoise" />
                  Sala de Decisión
                </span>
                <span className="text-[10px] text-bia-turquoise group-hover:translate-x-0.5 transition-transform">
                  Abrir →
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-snug font-sans">
                Auditoría multivariable y resolución de incidencias.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Engine Status Tag */}
      <div className="p-3 rounded-lg bg-bia-navy-950 border border-bia-navy-750 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-bia-turquoise shadow-sm shadow-bia-turquoise" />
          <span>Bia Energy Intelligence</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-relaxed font-mono">
          Mediana + MAD (7d) · LLM: gemini-3.5-flash-lite
        </p>
      </div>
    </aside>
  );
};
