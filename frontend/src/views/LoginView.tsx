import React, { useState } from 'react';
import {
  Zap,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { User } from '../types/auth';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

const REMEMBER_ME_KEY = 'bia_remember_me';
const REMEMBERED_USER_KEY = 'bia_remembered_identifier';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [identifier, setIdentifier] = useState<string>(() => {
    try {
      const isRemembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
      if (isRemembered) {
        return localStorage.getItem(REMEMBERED_USER_KEY) || 'elena.morales';
      }
    } catch {}
    return 'elena.morales';
  });

  const [password, setPassword] = useState('Elena#Bia2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      // Persistir o limpiar usuario recordado según la selección
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, 'true');
          localStorage.setItem(REMEMBERED_USER_KEY, identifier.trim());
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
          localStorage.removeItem(REMEMBERED_USER_KEY);
        }
      } catch {}

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
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Bia<span className="text-cyan-600 dark:text-bia-turquoise">.</span>
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
          <div className="flex items-center pt-0.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={rememberMe}
              onClick={() => setRememberMe((prev) => !prev)}
              className="group inline-flex items-center gap-2.5 cursor-pointer select-none text-left bg-transparent border-0 p-0 focus:outline-hidden"
            >
              <div
                className={`w-4 h-4 rounded-md flex items-center justify-center transition-all duration-200 border ${
                  rememberMe
                    ? 'bg-bia-turquoise border-bia-turquoise text-bia-navy-950 shadow-xs shadow-bia-turquoise/30 scale-105'
                    : 'bg-slate-100 border-slate-300 dark:bg-bia-navy-950 dark:border-white/[0.18] group-hover:border-slate-400 dark:group-hover:border-bia-turquoise/60'
                }`}
              >
                <Check
                  className={`w-3 h-3 stroke-[3] transition-all duration-150 ${
                    rememberMe
                      ? 'opacity-100 scale-100 text-bia-navy-950'
                      : 'opacity-0 scale-50'
                  }`}
                />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                Recordar sesión
              </span>
            </button>
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
      </div>
    </div>
  );
};
