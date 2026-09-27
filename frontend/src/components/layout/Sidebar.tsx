import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Gauge,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';

export type ViewType = 'dashboard' | 'meters' | 'meter-detail' | 'anomalies' | 'investigation';

export interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType, contextId?: string) => void;
  openAnomaliesCount?: number;
  selectedMeterId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge: string | null;
  badgeColor?: string;
  active: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  openAnomaliesCount = 0,
  selectedMeterId: _selectedMeterId,
  isCollapsed = false,
  onToggleCollapse,
  isPinned = false,
  onTogglePin,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const handleItemClick = (view: ViewType, contextId?: string) => {
    onNavigate(view, contextId);
  };

  const isDashboardActive = currentView === 'dashboard';
  const isMetersActive = currentView === 'meters' || currentView === 'meter-detail';
  const isAnomaliesActive = currentView === 'anomalies' || currentView === 'investigation';

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
      badge: null,
      active: isDashboardActive,
    },
    {
      id: 'meters',
      label: 'Medidores',
      icon: <Gauge className="w-4 h-4 shrink-0" />,
      badge: null,
      active: isMetersActive,
    },
    {
      id: 'anomalies',
      label: 'Anomalías',
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
      badge: openAnomaliesCount > 0 ? String(openAnomaliesCount) : null,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-bia-coral/15 dark:text-bia-coral dark:border-bia-coral/30',
      active: isAnomaliesActive,
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Sidebar (Collapsible Rail) */}
      <aside
        data-sidebar="true"
        className={`${
          isCollapsed ? 'w-16 p-2.5 pb-6 overflow-y-auto' : 'w-64 p-4 pb-6 overflow-y-auto'
        } bg-white/95 dark:bg-[#0a0f1d] backdrop-blur-md border-r border-slate-200/80 dark:border-[#1b243b] flex flex-col shrink-0 hidden md:flex h-full select-none z-30 transition-[width,padding] duration-200 ease-in-out relative`}
      >
        <div className="space-y-3">
          {/* Header Controls */}
          {isCollapsed ? (
            <div className="flex flex-col items-center pb-2 border-b border-slate-100 dark:border-white/[0.04]">
              <button
                onClick={onToggleCollapse}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer group relative"
                aria-label="Expandir menú lateral"
                title="Expandir menú lateral"
              >
                <PanelLeftOpen className="w-4 h-4 text-slate-400 group-hover:text-bia-turquoise transition-colors" />
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 whitespace-nowrap shadow-xl">
                  Expandir menú
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.04] min-w-[200px]">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 whitespace-nowrap">
                Navegación
              </span>
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer group relative"
                  aria-label="Compactar menú"
                  title="Compactar menú"
                >
                  <PanelLeftClose className="w-3.5 h-3.5 group-hover:text-bia-turquoise transition-colors" />
                </button>
              )}
            </div>
          )}

          {/* Navigation Items */}
          <nav className={`space-y-1.5 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            {navItems.map((item) => {
              const active = item.active;
              return (
                <div key={item.id} className="relative w-full flex justify-center">
                  <button
                    onClick={() => handleItemClick(item.id as ViewType)}
                    className={`group relative flex items-center ${
                      isCollapsed
                        ? 'justify-center w-10 h-10 p-0'
                        : 'w-full justify-between px-3 py-2.5'
                    } rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-bia-turquoise/15 text-bia-turquoise border border-bia-turquoise/30 font-semibold shadow-xs shadow-bia-turquoise/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                    }`}
                    aria-label={item.label}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                      <span className={`shrink-0 ${active ? 'text-bia-turquoise' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <span className="truncate whitespace-nowrap font-medium">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                          item.badgeColor || 'bg-white/[0.03] text-slate-300 border-white/[0.06]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isCollapsed && item.badge && (
                      <span
                        className={`absolute -top-1 -right-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border shadow-xs ${
                          item.badgeColor || 'bg-bia-coral text-white border-bia-coral/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Floating Tooltip in compact mode */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                              item.badgeColor || 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Drawer (Visible on md:hidden when isMobileOpen is true) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-bia-navy-900 border-r border-slate-200 dark:border-white/10 p-5 flex flex-col h-full shadow-2xl z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    Bia<span className="text-bia-turquoise">.</span>
                  </span>
                </div>
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  aria-label="Cerrar menú"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Navigation Items */}
              <div className="mt-4">
                <p className="px-2 text-[10px] uppercase font-mono font-medium tracking-wider text-slate-400 mb-2">
                  Navegación
                </p>
                <nav className="space-y-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id as ViewType);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        item.active
                          ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 dark:bg-bia-turquoise/[0.12] dark:text-bia-turquoise dark:border-bia-turquoise/25'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={item.active ? 'text-teal-600 dark:text-bia-turquoise' : 'text-slate-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                            item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/[0.05] dark:text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
