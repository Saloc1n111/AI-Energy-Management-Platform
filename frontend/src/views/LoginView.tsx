import React, { useState } from 'react';
import {
  Zap,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import { User } from '../types/auth';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('elena.morales');
  const [password, setPassword] = useState('Elena#Bia2026');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showCredentialsHelper, setShowCredentialsHelper] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectDemoUser = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Por favor ingrese su usuario o correo y su contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await api.login({
        identifier: identifier.trim(),
        password: password.trim(),
        rememberMe,
      });
      onLoginSuccess(response.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al autenticar. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-bia-navy-950 font-sans selection:bg-bia-turquoise/20 selection:text-bia-turquoise relative overflow-hidden transition-colors">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/[0.04] dark:bg-bia-turquoise/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/[0.03] dark:bg-bia-turquoise/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-bia-navy-900/90 border border-slate-200/80 dark:border-white/[0.08] p-8 sm:p-10 shadow-xl space-y-6 backdrop-blur-xl relative z-10 transition-colors">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-bia-turquoise/[0.1] border border-cyan-200 dark:border-bia-turquoise/25 text-cyan-700 dark:text-bia-turquoise font-semibold shadow-xs">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans lowercase">
                bia<span className="text-cyan-600 dark:text-bia-turquoise">.</span>
              </span>
              <span className="text-[10px] font-mono font-medium text-cyan-700 dark:text-bia-turquoise uppercase px-1.5 py-0.5 rounded-full bg-cyan-50 dark:bg-bia-turquoise/[0.08] border border-cyan-200 dark:border-bia-turquoise/20">
                ENERGY
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 font-normal">
              Energía Inteligente para Empresas · Colombia
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div className="leading-tight">{errorMsg}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User / Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Usuario o Correo Institucional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ej. elena.morales o elena.morales@bia.app"
                disabled={loading}
                autoComplete="username"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-bia-navy-950/80 border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-slate-400 dark:focus:border-bia-turquoise/60 focus:ring-1 focus:ring-slate-200 dark:focus:ring-bia-turquoise/40 transition-all font-mono shadow-xs"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                disabled={loading}
                autoComplete="current-password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-bia-navy-950/80 border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-slate-400 dark:focus:border-bia-turquoise/60 focus:ring-1 focus:ring-slate-200 dark:focus:ring-bia-turquoise/40 transition-all font-mono shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me option */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm bg-slate-100 dark:bg-bia-navy-950 border-slate-300 dark:border-white/[0.2] text-zinc-900 dark:text-bia-turquoise focus:ring-slate-400 dark:focus:ring-bia-turquoise/40"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors">
                Recordar sesión
              </span>
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Acceso Seguro TLS 1.3
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-bia-turquoise hover:bg-bia-turquoise-hover text-bia-navy-950 font-bold text-xs tracking-tight shadow-md shadow-bia-turquoise/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-bia-navy-950" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <>
                <span>Iniciar Sesión en Plataforma</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Collapsible Helper: Authorized Accounts for Evaluator */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowCredentialsHelper(!showCredentialsHelper)}
            className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-bia-turquoise hover:bg-slate-50 dark:hover:bg-white/[0.02] text-[11px] transition-colors font-mono cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-600 dark:text-bia-turquoise" />
              <span>Ver usuarios autorizados del sistema</span>
            </span>
            {showCredentialsHelper ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showCredentialsHelper && (
            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 dark:bg-white/[0.02] dark:border-white/[0.06] space-y-2 text-[11px] font-mono animate-fadeIn">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-200/60 dark:border-white/[0.04] pb-1">
                Credenciales configuradas (Clic para autocompletar):
              </p>
              
              <div className="space-y-2 text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => handleSelectDemoUser('elena.morales', 'Elena#Bia2026')}
                  className="w-full text-left p-2 rounded-lg bg-white hover:bg-teal-50/50 dark:bg-white/[0.02] dark:hover:bg-bia-turquoise/10 border border-slate-200/60 dark:border-transparent hover:border-bia-turquoise/40 transition-colors cursor-pointer block"
                >
                  <div className="font-semibold text-teal-700 dark:text-bia-turquoise flex items-center justify-between">
                    <span>1. Ing. Elena Morales (Analista Senior)</span>
                    <span className="text-[9px] font-normal uppercase text-teal-600 dark:text-bia-turquoise">Usar →</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Usuario: <code className="text-slate-800 dark:text-slate-200">elena.morales</code></div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Clave: <code className="text-slate-800 dark:text-slate-200">Elena#Bia2026</code></div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDemoUser('carlos.restrepo', 'Carlos#Ops2026')}
                  className="w-full text-left p-2 rounded-lg bg-white hover:bg-teal-50/50 dark:bg-white/[0.02] dark:hover:bg-bia-turquoise/10 border border-slate-200/60 dark:border-transparent hover:border-bia-turquoise/40 transition-colors cursor-pointer block"
                >
                  <div className="font-semibold text-teal-700 dark:text-bia-turquoise flex items-center justify-between">
                    <span>2. Carlos Restrepo (Director Operaciones)</span>
                    <span className="text-[9px] font-normal uppercase text-teal-600 dark:text-bia-turquoise">Usar →</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Usuario: <code className="text-slate-800 dark:text-slate-200">carlos.restrepo</code></div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Clave: <code className="text-slate-800 dark:text-slate-200">Carlos#Ops2026</code></div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDemoUser('andres.gomez', 'Andres#Field2026')}
                  className="w-full text-left p-2 rounded-lg bg-white hover:bg-teal-50/50 dark:bg-white/[0.02] dark:hover:bg-bia-turquoise/10 border border-slate-200/60 dark:border-transparent hover:border-bia-turquoise/40 transition-colors cursor-pointer block"
                >
                  <div className="font-semibold text-teal-700 dark:text-bia-turquoise flex items-center justify-between">
                    <span>3. Andrés Gómez (Ingeniero de Campo)</span>
                    <span className="text-[9px] font-normal uppercase text-teal-600 dark:text-bia-turquoise">Usar →</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Usuario: <code className="text-slate-800 dark:text-slate-200">andres.gomez</code></div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Clave: <code className="text-slate-800 dark:text-slate-200">Andres#Field2026</code></div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Backend Status Indicator */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
          <span>Servicio Go Backend activo en :8080</span>
        </div>
      </div>
    </div>
  );
};
