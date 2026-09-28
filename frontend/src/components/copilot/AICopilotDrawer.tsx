import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../api/client';
import { ContextType, AskAIResponse, ActionDTO } from '../../types/copilot';
import { User as AuthUser } from '../../types/auth';
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
  currentUser?: AuthUser | null;
  onNavigateToMeter?: (meterId: string) => void;
  onRequestTechnicalVisit?: (meterId: string) => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  context,
  currentUser,
  onNavigateToMeter,
  onRequestTechnicalVisit,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userFirstName = useMemo(() => {
    if (!currentUser?.name) return 'Elena';
    const cleaned = currentUser.name.replace(/^(ing\.|dr\.|dra\.|lic\.|sr\.|sra\.)\s+/i, '').trim();
    const first = cleaned.split(' ')[0];
    return first || 'Elena';
  }, [currentUser?.name]);

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

    const initialText = context
      ? `Hola, ${userFirstName}. Soy tu **Especialista en Inteligencia Energética de Bia**. Estás consultando **${context.title}**.\n\nTodo mi análisis traduce la física y el estado eléctrico de tu planta a lenguaje humano, amigable y con impacto directo en tus costos y operaciones. ¿Qué te gustaría consultar sobre este punto?`
      : `Hola, ${userFirstName}. Soy tu **Especialista en Inteligencia Energética de Bia**. Superviso continuamente los 12 medidores de tu planta industrial en tiempo real.\n\n¿En qué medidor, costo o aspecto técnico de tu instalación puedo orientarte hoy?`;

    const initialGreeting: Message = {
      id: 'init_' + Date.now(),
      sender: 'assistant',
      text: initialText,
      keyTakeaways: [
        'Explicaciones expertas con analogías claras y sin tecnicismos confusos',
        'Enfoque en costos, seguridad eléctrica de tableros y continuidad operativa',
      ],
      followUpQuestions: getContextSuggestions(context),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialGreeting]);
    try {
      localStorage.setItem(storageKey, JSON.stringify([initialGreeting]));
    } catch {}
  }, [context?.id, isOpen, storageKey, userFirstName]);

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

    // Keep conversation flow: send the last 6 messages
    const history = messages.slice(-6).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    try {
      const res: AskAIResponse = await api.askAI({
        context_type: context?.type || 'general',
        context_id: context?.id || 'overview',
        question: textToSend,
        context_data: {
          ...context?.data,
          user_name: currentUser?.name || 'Elena Morales',
          user_first_name: userFirstName,
          conversation_history: history,
        },
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
      const hasHistory = messages.length > 0;

      // A. Agradecimiento y cierre
      if (lower.includes('gracias') || lower.includes('agradezco')) {
        fallbackText = `Con el mayor gusto, ${userFirstName}. Recuerda que estoy supervisando la telemetría de tus 12 medidores industriales las 24 horas del día. Si detectas cualquier variación o necesitas apoyo con una visita técnica en campo, aquí estaré para asesorarte. ¡Que tengas una excelente y productiva jornada operativa!`;
        fallbackKeyTakeaways = [
          'Supervisión continua activa 24/7 sobre los 12 puntos de medición',
          'Canal directo habilitado para coordinar inspecciones técnicas preventivas',
        ];
        fallbackFollowUps = [
          '¿Cómo está el consumo general de mi planta?',
          '¿Cuáles medidores requieren mi atención inmediata hoy?',
          '¿Cómo puedo reducir los costos de energía este mes?',
        ];
      } else if (
        lower === 'entendido' ||
        lower === 'perfecto' ||
        lower === 'excelente' ||
        lower === 'de acuerdo' ||
        lower === 'ok' ||
        lower === 'listo' ||
        lower.startsWith('entendido') ||
        lower.startsWith('perfecto')
      ) {
        fallbackText = `Excelente, ${userFirstName}. Me alegra haberte aclarado la situación técnica de forma sencilla. ¿Deseas consultar algún otro punto de medición de tu planta o revisar recomendaciones de ahorro para este mes?`;
        fallbackKeyTakeaways = [
          'Diagnóstico técnico y recomendaciones asimiladas',
          'Monitoreo continuo activo en todos los circuitos de la fábrica',
        ];
        fallbackFollowUps = [
          '¿Cuáles medidores requieren mi atención inmediata hoy?',
          '¿Cómo puedo reducir los costos de energía este mes?',
          '¿Cuáles son los 3 medidores con mayor consumo de la planta?',
        ];
      } else if (
        lower === 'hola' ||
        lower.startsWith('hola') ||
        lower.includes('buenos d') ||
        lower.includes('buenas t') ||
        lower.includes('buenas n')
      ) {
        if (hasHistory) {
          fallbackText = `Dime, ${userFirstName}, ¿en qué punto técnico, medidor o costo puntual deseas que nos enfoquemos ahora?`;
          fallbackKeyTakeaways = [
            'Supervisión continua activa en los 12 puntos de medición',
            'Medidor M-109 prioritario por sobrecarga térmica y sobrecostos',
          ];
        } else {
          fallbackText = `¡Hola, ${userFirstName}! Soy tu **Especialista de Inteligencia Energética de Bia**.\n\nEstoy aquí para responder cualquier duda sobre tus consumos, costos, medidores y alertas en lenguaje 100% claro y con analogías sencillas.\n\nActualmente el punto prioritario que requiere atención en tu planta es el **medidor M-109** (Subestación Principal), que duplicó su consumo sin justificación operativa.\n\n¿Qué te gustaría consultar hoy?`;
          fallbackKeyTakeaways = [
            'Supervisión continua en tiempo real de los 12 medidores de tu planta',
            'Medidor M-109 en estado prioritario (+110.7% de consumo inusual)',
            'Puedes preguntarme sobre costos, medidores específicos o solicitar una visita técnica',
          ];
        }
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
      } else if (
        lower.includes('riesgo') ||
        lower.includes('peligro') ||
        lower.includes('quemar') ||
        lower.includes('daño') ||
        lower.includes('seguridad') ||
        lower.includes('consecuencia')
      ) {
        fallbackText = `${userFirstName}, el riesgo en el **medidor M-109** (Subestación Principal) no es solo económico, sino **físico y de seguridad operativa para toda la planta**:\n\n• **Degradación térmica del aislamiento por Efecto Joule ($I^2R$)**: Al subir la corriente a 424 Amperios (+110.5% sobre los 201 A nominales), el calor disipado en los cables se cuadruplica ($I^2$). Esto debilita la capa aislante de los conductores principales, con riesgo inminente de fundición o cortocircuito franco.\n• **Riesgo en el transformador principal**: El transformador 1 opera bajo estrés térmico severo; si la temperatura del aceite o devanados supera el límite de diseño, existe riesgo de conato de incendio en la celda de media tensión.\n• **Disparo intempestivo de protecciones generales**: Los interruptores termomagnéticos se disparan por sobrecalentamiento. Si esto ocurre, **se apagará la planta de forma abrupta**, arruinando lotes de producción en curso y dañando motores por corte seco.\n\n**Recomendación prioritaria**: Coordinar de inmediato la visita técnica de Bia para realizar inspección termográfica en tableros y evaluar la desenergización preventiva de cargas no esenciales.`;
        fallbackKeyTakeaways = [
          'Pérdidas térmicas cuadruplicadas por efecto Joule (I²R): riesgo de fundir aislamiento',
          'Riesgo de incendio o avería grave en el transformador de la subestación',
          'Posibilidad de disparo general imprevisto y paralización de toda la planta',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Solicitar visita técnica urgente para M-109',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Inspección termográfica preventiva de tableros en menos de 48h.',
          },
        ];
        fallbackFollowUps = [
          '¿Cuánto dinero extra me puede costar este incremento?',
          '¿Qué debo verificar antes de que llegue la visita técnica?',
        ];
      } else if (
        lower.includes('costo') ||
        lower.includes('dinero') ||
        lower.includes('factura') ||
        lower.includes('recibo') ||
        lower.includes('cuánto') ||
        lower.includes('cuanto') ||
        lower.includes('plata') ||
        lower.includes('penalidad') ||
        lower.includes('precio') ||
        lower.includes('más cara') ||
        lower.includes('mas cara')
      ) {
        if (context?.id === 'M-112' || lower.includes('112') || lower.includes('sensor')) {
          fallbackText = `${userFirstName}, en el **medidor M-112** (Inyección y Moldeo) **no habrá sobrecosto alguno en tu factura de energía**:\n\n1. La anomalía es exclusivamente una interferencia de comunicación en el transductor de voltaje Modbus interno (el velocímetro que oscila en pantalla).\n2. El consumo real de energía activa de tus inyectoras se mantuvo completamente nominal (+0.4% de variación).\n3. Tu facturación eléctrica oficial se calcula con el medidor fiscal homologado por el operador de red, el cual registra consumo normal.\n\nPor lo tanto, este evento no incrementa tu tarifa ni te generará ningún cobro sorpresa.`;
          fallbackKeyTakeaways = [
            'Cero sobrecostos en tu recibo de energía por el medidor M-112',
            'La facturación oficial se basa en el medidor de frontera comercial',
            'Las máquinas de inyección operan con total normalidad',
          ];
          fallbackFollowUps = [
            '¿Tengo que apagar alguna máquina en el área M-112?',
            '¿Bia puede corregir esta medición de forma remota?',
          ];
        } else {
          fallbackText = `${userFirstName}, el impacto económico del medidor **M-109** (Subestación Principal) es doble y muy severo si no se interviene a tiempo:\n\n1. **Sobrecosto por Energía Activa (kWh)**: El consumo diario subió de 1,048 kWh a 2,208 kWh (+1,160 kWh extra cada día). En un solo mes de operación continuada, esto representa más de **34,800 kWh adicionales** facturados a tarifa industrial plena.\n2. **Fuerte Penalidad por Energía Reactiva (FP 0.74)**: Al caer el factor de potencia a 0.74, casi un 26% de la energía que pasa por los cables es reactiva inductiva ('espuma'). Los operadores de red aplican penalizaciones económicas por transporte de reactiva según regulación, lo que incrementa el costo unitario de tu recibo.\n\n**Estimación**: Resolver este punto a tiempo mediante la inspección técnica de Bia evita sobrecostos millonarios en tu próximo corte de facturación.`;
          fallbackKeyTakeaways = [
            '+1,160 kWh diarios de sobreconsumo activo no justificado',
            'Penalización tarifaria por bajo factor de potencia (0.74)',
            'Atención inmediata protege el presupuesto energético del mes',
          ];
          fallbackActions = [
            {
              id: 'request_visit_m109',
              label: 'Solicitar visita técnica para M-109',
              action_type: 'technical_visit',
              payload: 'M-109',
              description: 'Inspección termográfica para eliminar sobrecostos.',
            },
          ];
          fallbackFollowUps = [
            '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
            '¿Qué debo verificar antes de que llegue la visita técnica?',
          ];
        }
      } else if (
        lower.includes('verificar') ||
        lower.includes('revisar') ||
        lower.includes('preparar') ||
        lower.includes('antes') ||
        lower.includes('visita técnica') ||
        lower.includes('visita tecnica') ||
        lower.includes('inspección') ||
        lower.includes('inspeccion')
      ) {
        fallbackText = `${userFirstName}, antes de que el equipo de ingenieros de Bia arribe a la planta para inspeccionar el **medidor M-109**, te recomiendo esta lista de verificación segura y no técnica:\n\n1. **Revisar la bitácora operativa de planta**: Confirma si durante los días 12 al 14 de septiembre se conectó maquinaria pesada temporal, motores de respaldo o bancos de prueba no programados.\n2. **Inspección visual y olfativa exterior (sin abrir celdas vivas)**: Verifica desde el pasillo si en el tablero general o la celda del transformador se percibe olor a plástico caliente, ozono o vibración acústica anómala.\n3. **Despejar el acceso físico a la subestación**: Asegura que el transformador 1 y el tablero de distribución principal tengan pasillos despejados y llaves disponibles para el ingreso seguro del personal técnico.\n4. **Tener disponible el diagrama unifilar**: Facilitará al ingeniero de Bia contrastar las cargas teóricas con la lectura real de la cámara termográfica y el analizador de redes.`;
        fallbackKeyTakeaways = [
          'Verificar bitácora de maquinaria conectada sin reporte oficial',
          'Inspección olfativa y visual desde el exterior de tableros (sin tocar componentes vivos)',
          'Garantizar acceso físico y llaves de subestación para el equipo de Bia',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Confirmar solicitud de visita técnica (M-109)',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Coordinar fecha y franja horaria con los ingenieros de Bia.',
          },
        ];
        fallbackFollowUps = [
          '¿Cuánto dinero extra me puede costar este incremento?',
          '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
        ];
      } else if (lower.includes('apagar') || lower.includes('detener') || lower.includes('parar')) {
        if (context?.id === 'M-112' || lower.includes('112') || lower.includes('sensor')) {
          fallbackText = `No, ${userFirstName}. **No necesitas apagar ninguna máquina en el área M-112** (Inyección y Moldeo).\n\nTus equipos de inyección operan con total normalidad, seguridad y eficiencia. La oscilación en la gráfica es exclusivamente ruido en la señal del sensor de voltaje Modbus (analogía del velocímetro que oscila). Tu producción no corre ningún peligro y puede continuar sin interrupciones.`;
          fallbackKeyTakeaways = [
            'No requiere detener máquinas de inyección',
            'La producción se mantiene nominal y segura',
            'La falla es de telemetría del sensor, no de maquinaria',
          ];
          fallbackFollowUps = [
            '¿Bia puede corregir esta medición de forma remota?',
            '¿Esta falla de sensor afectará lo que pago en mi factura de energía?',
          ];
        } else {
          fallbackText = `${userFirstName}, en el medidor **M-109** (Subestación Principal) no se recomienda apagar la planta intempestivamente sin previo aviso, pero **sí debes coordinar con el jefe de turno** para identificar qué carga pesada está jalando 424 Amperios de forma continua y desconectar cargas secundarias no esenciales hasta que se realice la inspección termográfica.`;
          fallbackKeyTakeaways = [
            'No apagar toda la planta sin coordinación previa',
            'Identificar cargas secundarias desconectables para bajar corriente',
            'Esperar la inspección termográfica de tableros de Bia',
          ];
          fallbackFollowUps = [
            '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
            '¿Qué debo verificar antes de que llegue la visita técnica?',
          ];
        }
      } else if (lower.includes('remoto') || lower.includes('remota') || lower.includes('bia puede') || lower.includes('corregir')) {
        fallbackText = `Sí, ${userFirstName}. En casos como el medidor **M-112**, el equipo de Bia puede aplicar filtros digitales y recalibrar el transductor de telemetría de forma remota sin costo y sin necesidad de abrir tableros en la planta.\n\nNuestros ingenieros ajustan el filtro de ruido en el canal Modbus para eliminar lecturas espurias.`;
        fallbackKeyTakeaways = [
          'Corrección remota disponible para el sensor M-112',
          'Sin interrupción de operaciones ni costos adicionales',
        ];
        fallbackFollowUps = [
          '¿Esta falla de sensor afectará lo que pago en mi factura de energía?',
          '¿Tengo que apagar alguna máquina en el área M-112?',
        ];
      } else if (lower.includes('3 medidores') || lower.includes('tres medidores') || lower.includes('mayor consumo') || lower.includes('más consumen') || lower.includes('mas consumen') || lower.includes('ranking')) {
        fallbackText = `${userFirstName}, los 3 medidores con mayor consumo de energía en tu planta son:\n\n1. **M-109 (Subestación Principal · Transformador 1)**: ~2,208 kWh/día (en sobrecarga crítica; duplicó su baseline habitual).\n2. **M-104 (Línea de Producción · Envasado)**: ~1,726 kWh/día (aumento del +47.5% justificado por la nueva línea de envasado).\n3. **M-103 (Hornos de Tratamiento Térmico · Zona 2)**: ~850 kWh/día (operación térmica continua nominal en régimen eficiente).\n\nEntre estos tres puntos se concentra más del 65% de toda la energía consumida en tu fábrica.`;
        fallbackKeyTakeaways = [
          'M-109, M-104 y M-103 concentran más del 65% del consumo total',
          'M-109 es el único punto con sobrecosto crítico no justificado',
          'M-104 y M-103 operan de forma normal acorde a su carga productiva',
        ];
        fallbackFollowUps = [
          '¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?',
          '¿Cómo puedo reducir los costos de energía este mes?',
        ];
      } else if (lower.includes('reducir') || lower.includes('ahorrar') || lower.includes('optimizar') || lower.includes('menos pagar')) {
        fallbackText = `${userFirstName}, para reducir de inmediato la factura energética este mes, te recomiendo estas 3 acciones de alto impacto:\n\n1. **Controlar la sobrecorriente en M-109**: Es la fuga financiera número 1 de la planta. Normalizar los 424 Amperios y corregir el factor de potencia (0.74) evitará decenas de miles de kWh extra y costosas penalizaciones de energía reactiva impuestas por el operador de red.\n2. **Desplazar cargas térmicas fuera de horario pico**: Cargas como los hornos (M-103) y precalentadores pueden programar sus arranques en horario valle donde el costo por kWh es menor.\n3. **Confirmar la nueva línea base de M-104**: Asegurar que la nueva línea de envasado esté dentro de la capacidad contratada con tu comercializador para no sobrepasar la potencia máxima acordada.`;
        fallbackKeyTakeaways = [
          'Prioridad 1: Mitigar la sobrecarga y penalidad reactiva en M-109',
          'Prioridad 2: Desplazar cargas térmicas pesadas fuera de horario punta',
          'Prioridad 3: Calibrar contratos de potencia para la nueva línea M-104',
        ];
        fallbackFollowUps = [
          '¿Cuánto dinero extra me puede costar este incremento en M-109?',
          '¿Qué porcentaje de la energía se consume en horario pico?',
        ];
      } else if (lower.includes('horario pico') || lower.includes('horario punta') || lower.includes('punta') || lower.includes('pico')) {
        fallbackText = `${userFirstName}, en el sector industrial las horas pico o de punta (generalmente entre las 18:00 y las 22:00 h según tu operador) tienen una tarifa por kWh significativamente más alta y penalizan la demanda máxima.\n\nEn tu planta, el 28% del consumo total se concentra en estas 4 horas. Desplazar ciclos de arranque de motores pesados hacia horarios diurnos o nocturnos puede reducir hasta un 15% el costo de demanda en la factura.`;
        fallbackKeyTakeaways = [
          'Horario pico (18:00 - 22:00h) con tarifa y potencia castigada',
          '28% del consumo de la fábrica ocurre en ventana punta',
          'Desplazamiento de arranques genera ahorros directos de hasta 15%',
        ];
        fallbackFollowUps = [
          '¿Cuáles son los 3 medidores con mayor consumo de la planta?',
          '¿Cómo puedo reducir los costos de energía este mes?',
        ];
      } else if (
        lower.includes('requieren mi atención') ||
        lower.includes('requieren atencion') ||
        lower.includes('atención inmediata') ||
        lower.includes('atencion inmediata') ||
        lower.includes('urgente') ||
        lower.includes('cuáles medidores') ||
        lower.includes('cuales medidores')
      ) {
        fallbackText = `${userFirstName}, de los 12 medidores de tu planta industrial, únicamente **2 puntos** requieren tu atención hoy:\n\n1. **M-109 (Subestación Principal · Transformador 1)**: PRIORIDAD CRÍTICA. Sobrecarga sostenida de 424 Amperios (+110.7%) con calentamiento por efecto Joule y penalización reactiva (FP 0.74). Requiere inspección termográfica prioritaria.\n2. **M-112 (Inyección y Moldeo)**: PRIORIDAD MEDIA (Calidad de datos). Sensor de voltaje Modbus oscilando por ruido; tus máquinas operan con normalidad y Bia lo calibrará de forma remota.\n\nLos otros 10 medidores operan de manera 100% nominal, segura y eficiente.`;
        fallbackKeyTakeaways = [
          'M-109 es la única anomalía con riesgo de sobrecosto y sobrecalentamiento',
          'M-112 es un problema de sensor, no de maquinaria ni de facturación',
          '10 de 12 medidores operan con total normalidad',
        ];
        fallbackActions = [
          {
            id: 'request_visit_m109',
            label: 'Solicitar visita técnica para M-109',
            action_type: 'technical_visit',
            payload: 'M-109',
            description: 'Atiende la incidencia más crítica de la planta.',
          },
        ];
        fallbackFollowUps = [
          '¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?',
          '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
        ];
      } else if (
        lower.includes('actualizo la línea base') ||
        lower.includes('actualizo la linea base') ||
        lower.includes('línea base') ||
        lower.includes('linea base') ||
        lower.includes('baseline')
      ) {
        fallbackText = `${userFirstName}, para actualizar la línea base (por ejemplo en el medidor **M-104** tras activar la nueva línea de producción):\n\nEl sistema de IA de Bia procesa automáticamente una ventana de 7 días continuos de operación para recalibrar los estadísticos robustos (mediana y MAD). Esto asimila el nuevo consumo productivo como el nuevo estándar nominal, evitando que se disparen falsas alarmas en el futuro.`;
        fallbackKeyTakeaways = [
          'La IA recalibra la línea base tras 7 días continuos de registro',
          'Utiliza mediana y MAD para evitar distorsiones por picos espurios',
          'No requiere programación compleja por parte del operador',
        ];
        fallbackFollowUps = [
          '¿Este nuevo consumo de M-104 está dentro del presupuesto esperado?',
          '¿Cuáles son los 3 medidores con mayor consumo de la planta?',
        ];
      } else if (
        lower.includes('excluye') ||
        lower.includes('falsos positivos') ||
        lower.includes('parada') ||
        lower.includes('caldera')
      ) {
        fallbackText = `${userFirstName}, en el medidor **M-106** (Circuito Térmico de Caldera) la caída a cero consumo no es una falla técnica:\n\n**Analogía amigable**: Es como apagar el motor del automóvil para cambiarle el aceite y hacerle afinación: una pausa planificada indispensable para alargar su vida útil.\n\nLa IA cruzó la telemetría con la bitácora de mantenimiento y clasificó el evento como Falso Positivo, excluyéndolo del cálculo estadístico para que no distorsione tus reportes futuros.`;
        fallbackKeyTakeaways = [
          'Caída temporal explicada por mantenimiento de calderas en bitácora',
          'Consumo restablecido al nivel normal tras la parada',
          'La IA excluye automáticamente este periodo de futuros cálculos',
        ];
        fallbackFollowUps = [
          '¿Cómo registro futuros mantenimientos en el calendario?',
          '¿Cuáles medidores requieren mi atención inmediata hoy?',
        ];
      } else if (context?.id === 'M-109' || lower.includes('109') || lower.includes('sobrecarga')) {
        const intro = hasHistory
          ? `Respecto al **medidor M-109** (Subestación Principal), ${userFirstName}:`
          : `Hola ${userFirstName}. Como especialista en energía, revisé el **medidor M-109** (Subestación Principal):`;

        fallbackText = `${intro}\n\nTécnicamente lo que sucede es una **sobrecorriente crítica sostenida**: la corriente subió a **424 Amperios** (lo normal eran 201 A, un alza del +110.5%), duplicando el consumo habitual (+110.7%).\n\n**¿Cómo entenderlo de forma muy sencilla?**\n• **Efecto manguera y sobrecalentamiento**: Imagina una manguera de agua diseñada para 200 L/min por la que estás forzando 424 L/min. Por física eléctrica (*efecto Joule*, pérdidas $I^2R$), los cables y el transformador se calientan fuertemente. Esto arriesga quemar el aislamiento, causar un cortocircuito o incendio en la subestación y disparar las protecciones apagando la planta.\n• **Pérdidas por Factor de Potencia (0.74)**: Piensa en un vaso de cerveza: el líquido es la energía activa que hace trabajo útil en tus máquinas, y la espuma es la energía reactiva inductiva que solo satura los cables. Un factor de 0.74 significa que 26% de la corriente es 'pura espuma', lo cual genera un recargo económico severo en tu factura.\n\n**Recomendación**: Solicitar una inspección prioritaria para realizar termografía infrarroja en tableros y revisar el banco de condensadores.`;
        fallbackKeyTakeaways = [
          'Corriente duplicada a 424 A: calentamiento por efecto Joule (I²R)',
          'Factor de potencia en 0.74: recargo por energía reactiva en tu factura',
          'Recomendado solicitar visita técnica prioritaria para termografía en tableros',
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
          '¿Cuánto dinero extra me puede costar este incremento?',
          '¿Qué riesgo hay para mis equipos si no reviso esto hoy?',
          '¿Qué debo verificar antes de que llegue la visita técnica?',
        ];
      } else if (context?.id === 'M-112' || lower.includes('112') || lower.includes('sensor') || lower.includes('calidad')) {
        const intro = hasHistory
          ? `${userFirstName}, en el **medidor M-112** la situación técnica es totalmente diferente:`
          : `Hola ${userFirstName}. En el **medidor M-112** tus máquinas operan perfectamente:`;

        fallbackText = `${intro}\n\nEl consumo de energía real de tus máquinas es completamente normal (+0.4% de variación).\n\n**¿Qué está sucediendo técnicamente?**\nLa anomalía es exclusivamente de **Calidad de Datos**: el transductor de voltaje del canal Modbus está captando ruido electromagnético, lo que genera oscilaciones falsas en la telemetría durante 16 horas.\n\n**Analogía visual**: Es como manejar un automóvil suave y seguro a 60 km/h en carretera, pero la aguja del velocímetro parpadea entre 20 y 120 km/h. Tu motor y frenos están perfectos; solo el sensor está descalibrado.\n\n**¿Qué debes hacer?** No detengas tu producción. Bia recalibrará el sensor de forma remota sin costo ni afectación a tus procesos.`;
        fallbackKeyTakeaways = [
          'Tus máquinas de inyección operan normalmente; no hay riesgo mecánico',
          'La inconsistencia proviene del sensor de voltaje Modbus, no de la fábrica',
          'No genera sobrecostos ni requiere detener la producción',
        ];
        fallbackActions = [
          {
            id: 'view_meter_m112',
            label: 'Revisar medidor M-112',
            action_type: 'view_meter',
            payload: 'M-112',
            description: 'Observar las señales de telemetría reportadas por el medidor.',
          },
        ];
        fallbackFollowUps = [
          '¿Esta falla de sensor afectará lo que pago en mi factura de energía?',
          '¿Tengo que apagar alguna máquina en el área M-112?',
        ];
      } else if (context?.id === 'M-104' || lower.includes('104') || lower.includes('linea') || lower.includes('línea') || lower.includes('envasado')) {
        const intro = hasHistory
          ? `${userFirstName}, el alza de +47.5% en el **medidor M-104** (Línea de Envasado) está plenamente justificada:`
          : `Hola ${userFirstName}. Te explico el aumento de +47.5% en el **medidor M-104** (Línea de Envasado):`;

        fallbackText = `${intro}\n\nCoincide con la entrada en operación de la nueva línea de producción registrada en la bitácora de planta. Los voltajes se mantienen en 220 V estables y los motores operan con alta eficiencia.\n\n**Analogía clara**: Es como encender un segundo horno en una panadería porque aumentaron los pedidos: el consumo sube, pero porque produces más, no por una fuga eléctrica.\n\nSolo confirmaremos este nuevo nivel para recalibrar la línea base del sistema.`;
        fallbackKeyTakeaways = [
          'Aumento justificado por la nueva línea de envasado',
          'Instalación eléctrica trabajando de forma segura y nominal',
          'Actualizar la línea base para asimilar el nuevo nivel productivo',
        ];
        fallbackFollowUps = [
          '¿Cómo actualizo la línea base para esta nueva línea?',
          '¿Este nuevo consumo está dentro del presupuesto esperado?',
        ];
      } else if (context?.id === 'M-106' || lower.includes('106')) {
        const intro = hasHistory
          ? `${userFirstName}, en el **medidor M-106** (Circuito Térmico de Caldera) la lectura temporal es normal:`
          : `Hola ${userFirstName}. En el **medidor M-106** (Circuito Térmico de Caldera) la lectura temporal es normal:`;

        fallbackText = `${intro}\n\nLa caída de consumo a cero durante 6 horas fue clasificada como Falso Positivo porque coincidió con el mantenimiento preventivo de calderas programado en la bitácora.\n\n**Analogía amigable**: Es el equivalente exacto a apagar el motor del carro para cambiarle el aceite: no es una avería, sino una pausa planificada para alargar su vida útil.\n\nLa caldera ya retomó su régimen habitual y la IA excluyó este periodo para no distorsionar tus reportes.`;
        fallbackKeyTakeaways = [
          'Caída temporal explicada por mantenimiento de calderas planificado',
          'Consumo restablecido al nivel normal tras la parada',
          'No requiere intervención técnica',
        ];
        fallbackFollowUps = [
          '¿La IA excluye automáticamente estas paradas del cálculo futuro?',
          '¿Cómo registro futuros mantenimientos en el calendario?',
        ];
      } else {
        const intro = hasHistory
          ? `${userFirstName}, sobre tu consulta ("${textToSend}"):`
          : `Hola ${userFirstName}. Como especialista en energía de Bia, sobre tu consulta ("${textToSend}"):`;

        fallbackText = `${intro}\n\nSupervisamos continuamente los 12 medidores de tu planta industrial en tiempo real.\n\n• **Operación General**: 10 medidores operan en condiciones óptimas y eficientes.\n• **Atención Prioritaria (M-109)**: Sobrecarga crítica sostenida (+110.7%) con 424 Amperios y factor de potencia 0.74 en la subestación principal.\n• **Falla de Sensor (M-112)**: Ruido de telemetría en sensor sin impacto en tus máquinas.\n\n¿Deseas solicitar una visita técnica o revisar algún medidor específico?`;
        fallbackKeyTakeaways = [
          '10 de 12 medidores operan con total normalidad',
          'M-109 requiere atención prioritaria por sobrecalentamiento y sobrecostos',
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

  // Helper to determine action classification and visual presentation
  const getActionCategory = (action: ActionDTO): 'technical_visit' | 'view_meter' | 'ask_question' => {
    const actType = (action.action_type || '').toLowerCase();
    const actLabel = (action.label || '').toLowerCase();
    const actId = (action.id || '').toLowerCase();

    // 1. Explicit technical visit check (only genuine visit requests)
    const isVisit =
      actType === 'technical_visit' ||
      actType === 'request_visit' ||
      actId.includes('request_visit') ||
      actId.includes('solicitar_visita') ||
      actLabel.includes('solicitar visita') ||
      actLabel.includes('agendar visita') ||
      actLabel.includes('programar visita') ||
      actLabel.includes('coordinar visita') ||
      actLabel.includes('visita técnica') ||
      actLabel.includes('visita tecnica') ||
      (actLabel.includes('visita') && !actLabel.includes('telemetría') && !actLabel.includes('telemetria'));

    if (isVisit) {
      return 'technical_visit';
    }

    // 2. Chat question/query check
    if (actType === 'ask' || actType === 'query' || actType === 'ask_question' || actType === 'question') {
      return 'ask_question';
    }

    // 3. Otherwise, meter/telemetry navigation
    return 'view_meter';
  };

  const handleActionClick = (action: ActionDTO) => {
    const category = getActionCategory(action);
    const actLabel = action.label || '';
    const fullText = `${action.payload || ''} ${actLabel} ${action.id || ''}`;
    const meterMatch = fullText.match(/M-\d{3}/i);
    let targetMeter = meterMatch
      ? meterMatch[0].toUpperCase()
      : action.payload && action.payload.startsWith('M-')
      ? action.payload
      : context?.id?.startsWith('M-')
      ? context.id
      : 'M-109';

    if (category === 'technical_visit') {
      if (onRequestTechnicalVisit) {
        onRequestTechnicalVisit(targetMeter);
      }
      return;
    }

    if (category === 'view_meter') {
      if (onNavigateToMeter) {
        onNavigateToMeter(targetMeter);
        onClose();
      }
      return;
    }

    if (category === 'ask_question') {
      handleSend(actLabel);
      return;
    }

    // Safe fallback: navigate to meter if available, else send message
    if (onNavigateToMeter) {
      onNavigateToMeter(targetMeter);
      onClose();
    } else {
      handleSend(actLabel);
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
                  Asistente Bia IA
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
                        {m.suggestedActions.map((act) => {
                          const category = getActionCategory(act);
                          const isVisit = category === 'technical_visit';
                          const isMeter = category === 'view_meter';

                          return (
                            <button
                              key={act.id}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleActionClick(act);
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                                isVisit
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-bia-coral/20 dark:hover:bg-bia-coral/35 dark:text-bia-coral dark:border-bia-coral/50'
                                  : isMeter
                                  ? 'bg-zinc-900 hover:bg-black text-white dark:bg-bia-turquoise dark:hover:bg-bia-turquoise-hover dark:text-bia-navy-950'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] dark:text-white dark:border-white/10'
                              }`}
                            >
                              {isVisit ? (
                                <Wrench className="w-3.5 h-3.5" />
                              ) : isMeter ? (
                                <Zap className="w-3.5 h-3.5" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span>{act.label}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          );
                        })}
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
