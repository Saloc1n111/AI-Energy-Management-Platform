import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { ContextType, AskAIResponse, ActionDTO } from '../../types/copilot';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Wrench,
  ArrowRight,
  HelpCircle,
  RotateCcw,
  Zap,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export interface CopilotContext {
  type: ContextType;
  id: string;
  title: string;
  description?: string;
  data?: Record<string, any>;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  keyTakeaways?: string[];
  suggestedActions?: ActionDTO[];
  followUpQuestions?: string[];
  source?: string;
  timestamp: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotContext | null;
  onNavigateToMeter?: (meterId: string) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  context,
  onNavigateToMeter,
  onRequestTechnicalVisit,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggested questions based on active context
  const getContextSuggestions = (ctx: CopilotContext | null): string[] => {
    if (!ctx) {
      return [
        '¿Cómo está el consumo general de mi planta?',
        '¿Cuáles medidores requieren mi atención inmediata hoy?',
        '¿Cómo puedo reducir los costos de energía este mes?',
      ];
    }

    if (ctx.id === 'M-109' || ctx.type === 'anomaly') {
      return [
        '¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?',
        '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
        '¿Cuánto dinero extra me puede costar este incremento?',
        '¿Qué debo verificar antes de que llegue la visita técnica?',
      ];
    }

    if (ctx.id === 'M-112') {
      return [
        '¿Qué significa un problema de medición y me va a llegar más cara la luz?',
        '¿Tengo que apagar alguna máquina en el área M-112?',
        '¿Bia puede corregir esta medición de forma remota?',
      ];
    }

    if (ctx.id === 'M-104') {
      return [
        '¿Por qué este aumento del +47.5% es considerado normal?',
        '¿Cómo actualizo la línea base de producción en el sistema?',
      ];
    }

    if (ctx.id === 'M-106') {
      return [
        '¿Por qué una caída a cero consumo no es una falla peligrosa?',
        '¿La IA excluye esta parada para no distorsionar futuros reportes?',
      ];
    }

    if (ctx.id === 'total_consumption' || ctx.type === 'kpi') {
      return [
        '¿Por qué subió el consumo este periodo respecto al baseline?',
        '¿Cuáles son los 3 medidores con mayor consumo de la planta?',
        '¿Qué porcentaje de la energía se consume en horario pico?',
      ];
    }

    return [
      `¿Qué significa lo que estoy viendo en ${ctx.title}?`,
      '¿Qué acción me recomiendas tomar ahora mismo?',
      '¿Hay algún riesgo financiero u operativo en este dato?',
    ];
  };

  const storageKey = `bia_copilot_chat_${context?.id || 'global'}`;

  // Restore existing messages from localStorage or initialize with welcoming message
  useEffect(() => {
    if (!isOpen) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore parse error and proceed to default
    }

    if (context) {
      const initialGreeting: Message = {
        id: 'init_' + Date.now(),
        sender: 'assistant',
        text: `Hola, soy tu **Asesor de Inteligencia Energética de Bia**. Estás consultando **${context.title}**.\n\nTodo nuestro análisis está diseñado para personas de negocio: sin fórmulas complicadas ni jerga confusa. ¿Qué te gustaría saber sobre este dato?`,
        keyTakeaways: [
          'Explicaciones 100% en lenguaje claro y de negocio',
          'Enfoque en costos, continuidad operativa y seguridad',
        ],
        followUpQuestions: getContextSuggestions(context),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([initialGreeting]);
      try {
        localStorage.setItem(storageKey, JSON.stringify([initialGreeting]));
      } catch {}
    }
  }, [context?.id, isOpen, storageKey]);

  // Persist conversation updates automatically
  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, storageKey, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (questionText: string) => {
    const textToSend = questionText.trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res: AskAIResponse = await api.askAI({
        context_type: context?.type || 'general',
        context_id: context?.id || 'overview',
        question: textToSend,
        context_data: context?.data,
      });

      const assistantMsg: Message = {
        id: 'ast_' + Date.now(),
        sender: 'assistant',
        text: res.answer,
        keyTakeaways: res.key_takeaways,
        suggestedActions: res.suggested_actions,
        followUpQuestions: res.follow_up_questions,
        source: res.source,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      let fallbackText = '';
      let fallbackKeyTakeaways: string[] = [];
      let fallbackActions: ActionDTO[] = [];
      let fallbackFollowUps: string[] = [];

      const lower = textToSend.toLowerCase();
      if (lower === 'hola' || lower.startsWith('hola') || lower.includes('buenos') || lower.includes('buenas')) {
        fallbackText = '¡Hola! Soy tu **Asesor de Inteligencia Energética de Bia**.\n\nEstoy aquí para responder cualquier duda sobre tus consumos, costos, medidores y alertas en lenguaje 100% claro y sin tecnicismos.\n\nActualmente el punto prioritario que requiere atención en tu planta es el **medidor M-109** (Subestación Principal), que duplicó su consumo sin justificación operativa.\n\n¿Qué te gustaría consultar hoy?';
        fallbackKeyTakeaways = [
          'Supervisión continua en tiempo real de los 12 medidores de tu planta',
          'Medidor M-109 en estado prioritario (+110.7% de consumo inusual)',
          'Puedes preguntarme sobre costos, medidores específicos o solicitar una visita técnica',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Solicitar visita técnica para M-109',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Inspección técnica preventiva en menos de 48 horas.',
          },
        ];
        fallbackFollowUps = [
          '¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?',
          '¿Cuáles medidores requieren mi atención inmediata hoy?',
          '¿Cómo puedo reducir los costos de energía este mes?',
        ];
      } else if (context?.id === 'M-109' || lower.includes('109') || lower.includes('aumento') || lower.includes('inusual')) {
        fallbackText = 'Detectamos un incremento inusual de más del doble (+110.7%) en el consumo eléctrico del medidor M-109 durante las últimas horas.\n\n• Si realizaste cambios en tu operación (nuevos equipos, turnos extra o mayor producción), verifica que tu instalación eléctrica esté preparada.\n• Si no reconoces este aumento, te recomendamos solicitar una visita técnica lo antes posible. Un incremento inesperado y sostenido puede indicar una condición anormal en tus equipos que debe ser revisada para prevenir fallas o sobrecostos.';
        fallbackKeyTakeaways = [
          'Consumo duplicado (+110.7%) sin justificación operativa reportada',
          'Riesgo de sobrecosto en factura y daño en tableros de la subestación',
          'Recomendado solicitar visita técnica inmediata si no reconoces el cambio',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Solicitar visita técnica para M-109',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Un especialista técnico de Bia inspeccionará tu medidor en menos de 48 horas.',
          },
        ];
        fallbackFollowUps = [
          '¿Cuánto dinero extra me puede costar este aumento en M-109?',
          '¿Qué debo verificar antes de que llegue la visita técnica?',
        ];
      } else {
        fallbackText = `Estás en el centro de **Asesoría Integral de Energía Bia**.\n\nSobre tu consulta ("${textToSend}"): Analizamos continuamente los 12 medidores de tu planta industrial.\n\n• **Operación General**: 10 medidores operan de forma óptima.\n• **Atención Prioritaria (M-109)**: El medidor de la subestación principal concentra un sobreconsumo del +110.7% con riesgo de sobrecosto de $842,000 COP.\n• **Falla de Sensor (M-112)**: Falla de medición sin impacto en tus máquinas ni en tu producción.\n\n¿Deseas solicitar una visita técnica o revisar algún medidor en específico?`;
        fallbackKeyTakeaways = [
          '10 de 12 medidores operan con total normalidad',
          'M-109 requiere atención prioritaria por sobreconsumo',
          'Soporte técnico y visitas preventivas disponibles',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Solicitar visita técnica para M-109',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Inspección técnica preventiva en menos de 48 horas.',
          },
        ];
        fallbackFollowUps = [
          '¿Qué acción me recomiendas tomar ahora mismo?',
          '¿Cuáles medidores requieren mi atención inmediata hoy?',
          '¿Cómo puedo reducir los costos de energía este mes?',
        ];
      }

      const assistantFallbackMsg: Message = {
        id: 'ast_' + Date.now(),
        sender: 'assistant',
        text: fallbackText,
        keyTakeaways: fallbackKeyTakeaways,
        suggestedActions: fallbackActions,
        followUpQuestions: fallbackFollowUps,
        source: 'copilot:deterministic-client',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantFallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: ActionDTO) => {
    const actType = (action.action_type || '').toLowerCase();
    const actLabel = (action.label || '').toLowerCase();
    const actId = (action.id || '').toLowerCase();

    // Check if it's a technical visit
    if (
      actType === 'technical_visit' ||
      actType.includes('visit') ||
      actType.includes('visita') ||
      actLabel.includes('visita') ||
      actLabel.includes('técnica') ||
      actLabel.includes('tecnica') ||
      actId.includes('visit') ||
      actId.includes('visita')
    ) {
      let targetMeter = action.payload || context?.id || 'M-109';
      if (targetMeter === 'global' || targetMeter === 'overview') {
        targetMeter = 'M-109';
      }
      if (onRequestTechnicalVisit) {
        onRequestTechnicalVisit(targetMeter);
      }
      return;
    }

    // Check if it's meter navigation
    if (
      actType === 'view_meter' ||
      actType.includes('meter') ||
      actType.includes('view') ||
      actType.includes('nav') ||
      actLabel.includes('medidor') ||
      actLabel.includes('ver') ||
      actId.includes('meter')
    ) {
      let targetMeter = action.payload || context?.id || 'M-109';
      if (targetMeter === 'global' || targetMeter === 'overview' || targetMeter.startsWith('/')) {
        targetMeter = 'M-109';
      }
      if (onNavigateToMeter) {
        onNavigateToMeter(targetMeter);
        onClose();
      }
      return;
    }

    // Fallback: If it's an action, launch technical visit by default
    if (onRequestTechnicalVisit) {
      onRequestTechnicalVisit('M-109');
    }
  };

  const handleClearHistory = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setMessages([]);
    if (context) {
      const resetMsg: Message = {
        id: 'reset_' + Date.now(),
        sender: 'assistant',
        text: `Conversación reiniciada. ¿Qué otra duda tienes sobre **${context.title}**?`,
        followUpQuestions: getContextSuggestions(context),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([resetMsg]);
      try {
        localStorage.setItem(storageKey, JSON.stringify([resetMsg]));
      } catch {}
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-slate-900/60 dark:bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl h-full bg-white dark:bg-bia-navy-900 border-l border-slate-200/80 dark:border-bia-navy-750 shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-bia-navy-750 bg-slate-50/80 dark:bg-bia-navy-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 dark:bg-bia-turquoise/15 dark:border-bia-turquoise/40 dark:text-bia-turquoise flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Bia AI Copilot
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-bia-navy-950 text-cyan-700 dark:text-bia-turquoise border border-slate-200 dark:border-bia-turquoise/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-bia-turquoise animate-ping" />
                  Gemini 3.5 Flash Lite
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-300">
                Centro de análisis conversacional para resolver dudas sin tecnicismos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Reiniciar conversación"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-bia-navy-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-bia-navy-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        {context && (
          <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-bia-navy-950 border-b border-slate-200/60 dark:border-bia-navy-750 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 shrink-0">
                Contexto Activo:
              </span>
              <span className="text-xs font-bold text-cyan-700 dark:text-bia-turquoise font-mono truncate">
                {context.title}
              </span>
            </div>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono px-2 py-0.5 rounded bg-white dark:bg-bia-navy-900 border border-slate-200/80 dark:border-bia-navy-750 shrink-0 shadow-xs">
              {context.id}
            </span>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === 'user';

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 dark:bg-bia-turquoise/20 dark:border-bia-turquoise/40 dark:text-bia-turquoise flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-3 leading-relaxed ${
                    isUser
                      ? 'bg-zinc-900 text-white font-medium rounded-tr-xs shadow-xs dark:bg-bia-turquoise dark:text-bia-navy-950'
                      : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-xs dark:bg-bia-navy-850 dark:border-bia-navy-750 dark:text-slate-200'
                  }`}
                >
                  {/* Message Text with simple Markdown formatting */}
                  <div className="space-y-2 whitespace-pre-wrap font-sans">
                    {m.text.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx}>
                        {paragraph.split('**').map((part, idx) =>
                          idx % 2 === 1 ? <strong key={idx} className={isUser ? 'font-bold' : 'text-slate-900 dark:text-white font-bold'}>{part}</strong> : part
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Key Takeaways */}
                  {m.keyTakeaways && m.keyTakeaways.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-bia-navy-750/70 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">
                        Puntos Clave:
                      </p>
                      <div className="space-y-1">
                        {m.keyTakeaways.map((k, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-normal"
                          >
                            <span className="text-cyan-600 dark:text-bia-turquoise font-bold shrink-0">•</span>
                            <span>{k}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Actions within Response */}
                  {m.suggestedActions && m.suggestedActions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-bia-navy-750/70 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">
                        Acciones Recomendadas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {m.suggestedActions.map((act) => (
                          <button
                            key={act.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleActionClick(act);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs
                              bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-bia-coral/20 dark:hover:bg-bia-coral/35 dark:text-bia-coral dark:border-bia-coral/50 active:scale-95 cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{act.label}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Questions Chips */}
                  {m.followUpQuestions && m.followUpQuestions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-bia-navy-750/70 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-cyan-600 dark:text-bia-turquoise" />
                        <span>Preguntas Frecuentes Sugeridas:</span>
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {m.followUpQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSend(q)}
                            className="text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-[11px] text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-xs dark:bg-bia-navy-950 dark:hover:bg-bia-navy-800 dark:text-slate-300 dark:hover:text-bia-turquoise dark:border-bia-navy-750 transition-colors leading-snug cursor-pointer"
                          >
                            💬 {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-[9px] font-mono text-right ${
                      isUser ? 'text-white/70 dark:text-bia-navy-950/70' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 dark:bg-bia-navy-800 dark:border-bia-navy-750 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 dark:bg-bia-turquoise/20 dark:border-bia-turquoise/40 dark:text-bia-turquoise flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-50 border border-slate-200/80 text-xs text-slate-500 dark:bg-bia-navy-850 dark:border-bia-navy-750 dark:text-slate-400 flex items-center gap-2 shadow-xs font-mono">
                <div className="w-3.5 h-3.5 border-2 border-cyan-600/30 border-t-cyan-600 dark:border-bia-turquoise/30 dark:border-t-bia-turquoise rounded-full animate-spin" />
                <span>Analizando telemetría y formulando respuesta con Gemini...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-bia-navy-750 bg-slate-50/80 dark:bg-bia-navy-850 shrink-0 space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a la IA sobre lo que estás viendo..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-slate-400 dark:bg-bia-navy-950 dark:border-bia-navy-750 dark:text-white dark:focus:border-bia-turquoise transition-colors shadow-xs"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>💡 Haz clic en cualquier sugerencia o escribe libremente</span>
            {context?.id === 'M-109' && onRequestTechnicalVisit && (
              <button
                type="button"
                onClick={() => onRequestTechnicalVisit('M-109')}
                className="text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer dark:text-bia-coral"
              >
                <Wrench className="w-3 h-3" />
                <span>Pedir Visita Técnica M-109</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
