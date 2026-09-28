import React, { useState } from 'react';
import { api } from '../../api/client';
import { TechnicalVisitResponse } from '../../types/copilot';
import { Wrench, CheckCircle2, Clock, X, ShieldAlert, Phone, User, FileText } from 'lucide-react';

interface TechnicalVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeterId?: string;
  defaultReason?: string;
  onSuccess?: (ticketId: string) => void;
}

export const TechnicalVisitModal: React.FC<TechnicalVisitModalProps> = ({
  isOpen,
  onClose,
  defaultMeterId = 'M-109',
  defaultReason = 'Aumento inusual de consumo no reconocido (+110.7%). Inspección requerida para descartar fallas o riesgos eléctricos.',
  onSuccess,
}) => {
  const [meterId, setMeterId] = useState(defaultMeterId);
  const [urgency, setUrgency] = useState<'IMMEDIATE' | 'PRIORITY' | 'SCHEDULED'>('IMMEDIATE');
  const [reason, setReason] = useState(defaultReason);
  const [contactName, setContactName] = useState('Juan Sebastián Rivera');
  const [contactPhone, setContactPhone] = useState('+57 (311) 458-9201');
  const [notes, setNotes] = useState('Favor verificar tablero de distribución principal y transformadores de corriente.');
  const [loading, setLoading] = useState(false);
  const [confirmedVisit, setConfirmedVisit] = useState<TechnicalVisitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (defaultMeterId && defaultMeterId !== 'overview' && defaultMeterId !== 'global') {
        setMeterId(defaultMeterId);
      } else {
        setMeterId('M-109');
      }
    }
  }, [isOpen, defaultMeterId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.requestTechnicalVisit({
        meter_id: meterId,
        urgency,
        reason,
        contact_name: contactName,
        contact_phone: contactPhone,
        notes,
      });
      setConfirmedVisit(res);
      if (onSuccess) {
        onSuccess(res.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar la solicitud de visita técnica');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmedVisit(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-bia-navy-900 border border-slate-200/80 dark:border-bia-navy-750 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-bia-navy-750 flex items-center justify-between bg-slate-50/80 dark:bg-bia-navy-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-bia-coral/15 dark:border-bia-coral/30 dark:text-bia-coral">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Solicitar Visita Técnica en Sitio</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-bia-navy-950 text-cyan-700 dark:text-bia-turquoise border border-slate-200 dark:border-bia-turquoise/30">
                  Bia Field Support
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Inspección preventiva de medidores, tableros y cargas eléctricas
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-bia-navy-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmation Screen */}
        {confirmedVisit ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs dark:bg-bia-turquoise/15 dark:border-bia-turquoise/40 dark:text-bia-turquoise animate-in zoom-in-95">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-bia-turquoise font-bold">
                ¡Solicitud Registrada con Éxito!
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Ticket #{confirmedVisit.id}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                Hemos asignado tu solicitud para el medidor <strong className="text-slate-900 dark:text-white">{confirmedVisit.meter_id}</strong> a nuestro equipo de ingenieros especialistas en campo de Bia.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 text-left text-xs space-y-2 max-w-md mx-auto font-mono text-slate-700 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-slate-300">
              <div className="flex justify-between items-center">
                <span>Nivel de Urgencia:</span>
                <span className="font-bold text-rose-600 dark:text-bia-coral">{confirmedVisit.urgency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Contacto Registrado:</span>
                <span className="text-slate-900 dark:text-white">{confirmedVisit.contact_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Teléfono:</span>
                <span className="text-slate-900 dark:text-white">{confirmedVisit.contact_phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>SLA de Contacto:</span>
                <span className="text-emerald-700 dark:text-bia-turquoise font-bold">Menos de 2 Horas</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs shadow-xs transition-all cursor-pointer dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950"
              >
                Aceptar y Volver al Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono">
                  Medidor a Inspeccionar
                </label>
                <input
                  type="text"
                  value={meterId}
                  onChange={(e) => setMeterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono">
                  Nivel de Urgencia
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise shadow-xs"
                >
                  <option value="IMMEDIATE">🚨 Inmediata (24-48h) - Crítica</option>
                  <option value="PRIORITY">⚡ Prioritaria (3-5 días)</option>
                  <option value="SCHEDULED">📅 Programada (Próxima semana)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                <span>Motivo de la Visita</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise leading-relaxed resize-none shadow-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                  <span>Responsable en Planta</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-600 dark:text-bia-turquoise" />
                  <span>Teléfono de Contacto</span>
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+57 (300) 000-0000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise shadow-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 font-mono">
                Notas u Observaciones Operativas (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones para acceso, horarios o precauciones"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise shadow-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-slate-300">
              <Clock className="w-4 h-4 text-cyan-600 dark:text-bia-turquoise shrink-0" />
              <span>
                Tiempo de respuesta garantizado: el equipo de ingeniería te contactará en menos de 2 horas tras confirmar.
              </span>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-bia-navy-750">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer dark:bg-bia-navy-800 dark:hover:bg-bia-navy-750 dark:text-slate-300 shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Confirmar Solicitud de Visita</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
