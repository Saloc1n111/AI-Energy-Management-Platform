import React, { useState, useRef, useEffect } from 'react';
import { Zap, Sparkles, LogOut, ChevronDown, Building2, Menu, Sun, Moon, Play, Activity } from 'lucide-react';
import { User } from '../../types/auth';
import { useTheme } from '../../context/ThemeContext';

interface NavbarProps {
  onRunAnalysis?: () => void;
  isAnalyzing?: boolean;
  hasAnalysis?: boolean;
  analysisMessage?: string | null;
  onOpenCopilot?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  isMobileOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRunAnalysis,
  isAnalyzing = false,
  hasAnalysis = false,
  analysisMessage,
  onOpenCopilot,
  currentUser,
  onLogout,
  onToggleSidebar,
  isSidebarCollapsed = false,
  isMobileOpen = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayName = currentUser?.name || 'Ing. Elena Morales';
  const displayRole = currentUser?.role || 'Analista Senior de Energía';
  const displayInitials = currentUser?.initials || 'EM';
  const displayPlant = currentUser?.plant || 'Planta Norte · Operaciones';
  const displayEmail = currentUser?.email || 'elena.morales@bia.app';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-bia-navy-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.06] px-4 sm:px-6 py-3 flex items-center justify-between transition-colors shadow-xs">
      {/* Brand: Bia Energy with Hamburger Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <button
            data-sidebar-toggle="true"
            onClick={onToggleSidebar}
            className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center shrink-0 border ${
              !isSidebarCollapsed || isMobileOpen
                ? 'bg-bia-turquoise/15 text-bia-turquoise border-bia-turquoise/35 shadow-xs shadow-bia-turquoise/10'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-bia-turquoise hover:bg-slate-100 dark:hover:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.06]'
            }`}
            title={
              isMobileOpen
                ? 'Cerrar menú'
                : isSidebarCollapsed
                ? 'Expandir menú lateral (Ctrl+B)'
                : 'Compactar menú lateral (Ctrl+B)'
            }
            aria-label={
              isMobileOpen
                ? 'Cerrar menú'
                : isSidebarCollapsed
                ? 'Expandir menú lateral'
                : 'Compactar menú lateral'
            }
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bia-turquoise/10 border border-bia-turquoise/25 text-bia-turquoise font-semibold shadow-xs shrink-0">
          <Zap className="w-4 h-4 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
              Bia<span className="text-bia-turquoise">.</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal hidden sm:block">
            Energía Inteligente para Empresas · Telemetría en Tiempo Real
          </p>
        </div>
      </div>

      {/* Center / Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Bia Primary Action Button (Authentic Bright Turquoise) */}
        {onRunAnalysis && (
          <button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer active:scale-95 ${
              isAnalyzing
                ? 'bg-slate-200 dark:bg-bia-navy-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-white/[0.08]'
                : 'bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 shadow-sm shadow-bia-turquoise/25 hover:shadow-bia-turquoise/40'
            }`}
            title="Ejecutar diagnóstico y calibración de telemetría IA"
          >
            {isAnalyzing ? (
              <>
                <Activity className="w-3.5 h-3.5 animate-spin text-bia-navy-950 dark:text-bia-turquoise" />
                <span className="hidden sm:inline">Ejecutando Diagnóstico...</span>
                <span className="sm:hidden">Ejecutando...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current shrink-0" />
                <span className="hidden sm:inline">Ejecutar Diagnóstico IA</span>
                <span className="sm:hidden">Diagnóstico IA</span>
              </>
            )}
          </button>
        )}

        {/* Bia AI Copilot Global Button */}
        {onOpenCopilot && (
          <button
            onClick={onOpenCopilot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all
              bg-bia-turquoise/10 hover:bg-bia-turquoise/20 text-teal-700 dark:text-bia-turquoise border border-bia-turquoise/30 hover:border-bia-turquoise/60 shadow-xs active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-bia-turquoise animate-pulse" />
            <span>Bia Copilot</span>
          </button>
        )}

        {/* Theme Toggle (Sun / Moon) next to Bia Copilot */}
        <button
          onClick={toggleTheme}
          className="p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/70 border border-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.06] shadow-xs"
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          aria-label="Alternar tema de interfaz"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Operator Profile Dropdown */}
        <div className="relative pl-2 sm:pl-2.5 border-l border-slate-200/80 dark:border-white/[0.06]" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all text-left focus:outline-hidden cursor-pointer"
            title="Opciones de usuario"
          >
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-bia-turquoise/[0.08] dark:border-bia-turquoise/25 dark:text-bia-turquoise flex items-center justify-center text-[11px] font-semibold">
              {displayInitials}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight flex items-center gap-1">
                <span>{displayName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{displayRole}</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-bia-navy-900 border border-slate-200 dark:border-white/[0.08] shadow-2xl p-3 space-y-3 z-50 backdrop-blur-xl animate-fadeIn">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-teal-700 dark:text-bia-turquoise uppercase tracking-wider font-semibold">
                    Sesión Activa
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                </div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{displayEmail}</p>
                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>{displayPlant}</span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
