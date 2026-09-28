package ai

import (
	"context"
	"fmt"
	"strings"

	"energyhub/internal/domain/copilot"
)

type CopilotDeterministic struct{}

func NewCopilotDeterministic() *CopilotDeterministic {
	return &CopilotDeterministic{}
}

func (d *CopilotDeterministic) Name() string {
	return "deterministic:copilot"
}

// cleanFirstName strips honorific prefixes (Ing., Dr., etc.) and returns the first name.
func cleanFirstName(name string) string {
	trimmed := strings.TrimSpace(name)
	for _, prefix := range []string{"ing. ", "dr. ", "dra. ", "lic. ", "sr. ", "sra. "} {
		if strings.HasPrefix(strings.ToLower(trimmed), prefix) {
			trimmed = strings.TrimSpace(trimmed[len(prefix):])
			break
		}
	}
	parts := strings.Split(trimmed, " ")
	if len(parts) > 0 && parts[0] != "" {
		return parts[0]
	}
	return "Elena"
}

func (d *CopilotDeterministic) ExplainQuery(_ context.Context, q copilot.Question, extra map[string]interface{}) (copilot.Answer, error) {
	lowerQ := strings.ToLower(strings.TrimSpace(q.Question))
	meterID := q.ContextID
	if meterID == "" && extra != nil {
		if m, ok := extra["meter_id"].(string); ok {
			meterID = m
		}
	}

	totalMeters := 12
	if extra != nil {
		if tm, ok := extra["total_meters"].(int); ok && tm > 0 {
			totalMeters = tm
		} else if tmF, ok := extra["total_meters"].(float64); ok && tmF > 0 {
			totalMeters = int(tmF)
		}
	}

	totalReadings := totalMeters * 336
	if extra != nil {
		if tr, ok := extra["total_readings"].(int); ok && tr > 0 {
			totalReadings = tr
		} else if trF, ok := extra["total_readings"].(float64); ok && trF > 0 {
			totalReadings = int(trF)
		}
	}

	// 1. Personalización por primer nombre sin títulos académicos
	userName := "Elena"
	if extra != nil {
		if un, ok := extra["user_first_name"].(string); ok && strings.TrimSpace(un) != "" {
			userName = cleanFirstName(un)
		} else if un, ok := extra["user_name"].(string); ok && strings.TrimSpace(un) != "" {
			userName = cleanFirstName(un)
		}
	}

	// 2. Detección de conversación previa para no repetir saludos
	hasHistory := false
	if extra != nil {
		if hist, ok := extra["conversation_history"].([]interface{}); ok && len(hist) > 0 {
			hasHistory = true
		}
	}

	// =========================================================================
	// INTENCIONES CONVERSACIONALES: CORTESÍA, SEGUIMIENTO Y TEMAS ESPECÍFICOS
	// =========================================================================

	// A. Agradecimiento y cierre ("gracias", "muchas gracias", "mil gracias", "agradezco")
	if strings.Contains(lowerQ, "gracias") || strings.Contains(lowerQ, "agradezco") {
		return copilot.Answer{
			Answer: fmt.Sprintf("Con el mayor gusto, %s. Recuerda que estoy supervisando la telemetría de tus %d medidores industriales las 24 horas del día. Si detectas cualquier variación o necesitas apoyo con una visita técnica en campo, aquí estaré para asesorarte. ¡Que tengas una excelente y productiva jornada operativa!", userName, totalMeters),
			KeyTakeaways: []string{
				"Supervisión continua activa 24/7 sobre los 12 puntos de medición",
				"Canal directo habilitado para coordinar inspecciones técnicas preventivas",
			},
			FollowUpQuestions: []string{
				"¿Cómo está el consumo general de mi planta?",
				"¿Cuáles medidores requieren mi atención inmediata hoy?",
				"¿Cómo puedo reducir los costos de energía este mes?",
			},
			Source:    "deterministic:copilot",
			ContextID: q.ContextID,
		}, nil
	}

	// B. Confirmación / acuerdo ("entendido", "perfecto", "excelente", "de acuerdo", "ok", "listo", "comprendido")
	if lowerQ == "entendido" || lowerQ == "perfecto" || lowerQ == "excelente" || lowerQ == "de acuerdo" || lowerQ == "ok" || lowerQ == "listo" || strings.HasPrefix(lowerQ, "entendido") || strings.HasPrefix(lowerQ, "perfecto") {
		return copilot.Answer{
			Answer: fmt.Sprintf("Excelente, %s. Me alegra haberte aclarado la situación técnica de forma sencilla. ¿Deseas consultar algún otro punto de medición de tu planta o revisar recomendaciones de ahorro para este mes?", userName),
			KeyTakeaways: []string{
				"Diagnóstico técnico y recomendaciones asimiladas",
				"Monitoreo continuo activo en todos los circuitos de la fábrica",
			},
			FollowUpQuestions: []string{
				"¿Cuáles medidores requieren mi atención inmediata hoy?",
				"¿Cómo puedo reducir los costos de energía este mes?",
				"¿Cuáles son los 3 medidores con mayor consumo de la planta?",
			},
			Source:    "deterministic:copilot",
			ContextID: q.ContextID,
		}, nil
	}

	// C. Saludos ("hola", "buenos días", "buenas tardes", "buenas noches")
	if lowerQ == "hola" || strings.HasPrefix(lowerQ, "hola") || strings.Contains(lowerQ, "buenos d") || strings.Contains(lowerQ, "buenas t") || strings.Contains(lowerQ, "buenas n") {
		if hasHistory {
			return copilot.Answer{
				Answer: fmt.Sprintf("Dime, %s, ¿en qué punto técnico, medidor o costo puntual deseas que nos enfoquemos ahora?", userName),
				KeyTakeaways: []string{
					"Supervisión continua activa en los 12 puntos de medición",
					"Medidor M-109 prioritario por sobrecorriente y sobrecostos",
				},
				FollowUpQuestions: []string{
					"¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?",
					"¿Cuáles medidores requieren mi atención inmediata hoy?",
					"¿Cómo puedo reducir los costos de energía este mes?",
				},
				Source:    "deterministic:copilot",
				ContextID: q.ContextID,
			}, nil
		}

		return copilot.Answer{
			Answer: fmt.Sprintf("¡Hola, %s! Soy tu **Especialista de Inteligencia Energética de Bia**.\n\n"+
				"Estoy aquí para explicarte con total claridad técnica y analogías amigables lo que sucede en cada medidor de tu planta, sin tecnicismos confusos.\n\n"+
				"Actualmente el punto prioritario que requiere atención en tu planta es el **medidor M-109** (Subestación Principal), que duplicó su consumo sin justificación operativa.\n\n"+
				"¿Qué te gustaría consultar hoy?", userName),
			KeyTakeaways: []string{
				fmt.Sprintf("Supervisión continua en tiempo real de los %d medidores de tu planta", totalMeters),
				"Medidor M-109 en estado prioritario (+110.7% de consumo inusual)",
				"Puedes preguntarme sobre costos, medidores específicos o solicitar una visita técnica",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Solicitar visita técnica para M-109",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Inspección técnica preventiva en menos de 48 horas.",
				},
			},
			FollowUpQuestions: []string{
				"¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?",
				"¿Cuáles medidores requieren mi atención inmediata hoy?",
				"¿Cómo puedo reducir los costos de energía este mes?",
			},
			Source:    "deterministic:copilot",
			ContextID: q.ContextID,
		}, nil
	}

	// D. Riesgo para equipos / Peligro / Seguridad eléctrica / Conato / Daño
	if strings.Contains(lowerQ, "riesgo") || strings.Contains(lowerQ, "peligro") || strings.Contains(lowerQ, "quemar") || strings.Contains(lowerQ, "daño") || strings.Contains(lowerQ, "seguridad") || strings.Contains(lowerQ, "consecuencia") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, el riesgo en el **medidor M-109** (Subestación Principal) no es solo económico, sino **físico y de seguridad operativa para toda la planta**:\n\n"+
				"• **Degradación térmica del aislamiento por Efecto Joule ($I^2R$)**: Al subir la corriente a 424 Amperios (+110.5%% sobre los 201 A nominales), el calor disipado en los cables se cuadruplica ($I^2$). Esto debilita la capa aislante de los conductores principales, con riesgo inminente de fundición o cortocircuito franco.\n"+
				"• **Riesgo en el transformador principal**: El transformador 1 opera bajo estrés térmico severo; si la temperatura del aceite o los devanados supera el límite de diseño, existe riesgo de conato de incendio en la celda de media tensión.\n"+
				"• **Disparo intempestivo de protecciones generales**: Los interruptores termomagnéticos se disparan por sobrecalentamiento. Si esto ocurre, **se apagará la planta de forma abrupta**, arruinando lotes de producción en curso y dañando motores por corte seco.\n\n"+
				"**Recomendación prioritaria**: Coordinar de inmediato la visita técnica de Bia para realizar inspección termográfica en tableros y evaluar la desenergización preventiva de cargas no esenciales.", userName),
			KeyTakeaways: []string{
				"Pérdidas térmicas cuadruplicadas por efecto Joule (I²R): riesgo de fundir aislamiento",
				"Riesgo de incendio o avería grave en el transformador de la subestación",
				"Posibilidad de disparo general imprevisto y paralización de toda la planta",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Solicitar visita técnica urgente para M-109",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Inspección termográfica preventiva de tableros en menos de 48h.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cuánto dinero extra me puede costar este incremento?",
				"¿Qué debo verificar antes de que llegue la visita técnica?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// E. Impacto financiero / Costos / Factura / Dinero / Penalidades
	if strings.Contains(lowerQ, "costo") || strings.Contains(lowerQ, "dinero") || strings.Contains(lowerQ, "factura") || strings.Contains(lowerQ, "recibo") || strings.Contains(lowerQ, "cuánto") || strings.Contains(lowerQ, "cuanto") || strings.Contains(lowerQ, "plata") || strings.Contains(lowerQ, "penalidad") || strings.Contains(lowerQ, "precio") || strings.Contains(lowerQ, "más cara") || strings.Contains(lowerQ, "mas cara") {
		// Sub-caso M-112: Aclarar explícitamente que no sube la factura
		if meterID == "M-112" || strings.Contains(lowerQ, "112") || strings.Contains(lowerQ, "sensor") {
			return copilot.Answer{
				Answer: fmt.Sprintf("%s, en el **medidor M-112** (Inyección y Moldeo) **no habrá sobrecosto alguno en tu factura de energía**:\n\n"+
					"1. La anomalía es exclusivamente una interferencia de comunicación en el transductor de voltaje Modbus interno (el velocímetro que oscila en pantalla).\n"+
					"2. El consumo real de energía activa de tus inyectoras se mantuvo completamente nominal (+0.4%% de variación).\n"+
					"3. Tu facturación eléctrica oficial se calcula con el medidor fiscal homologado por el operador de red, el cual registra consumo normal.\n\n"+
					"Por lo tanto, este evento no incrementa tu tarifa ni te generará ningún cobro sorpresa.", userName),
				KeyTakeaways: []string{
					"Cero sobrecostos en tu recibo de energía por el medidor M-112",
					"La facturación oficial se basa en el medidor de frontera comercial",
					"Las máquinas de inyección operan con total normalidad",
				},
				FollowUpQuestions: []string{
					"¿Tengo que apagar alguna máquina en el área M-112?",
					"¿Bia puede corregir esta medición de forma remota?",
				},
				Source:    "deterministic:copilot",
				ContextID: "M-112",
			}, nil
		}

		// Caso M-109 / General de costos
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, el impacto económico del medidor **M-109** (Subestación Principal) es doble y muy severo si no se interviene a tiempo:\n\n"+
				"1. **Sobrecosto por Energía Activa (kWh)**: El consumo diario subió de 1,048 kWh a 2,208 kWh (+1,160 kWh extra cada día). En un solo mes de operación continuada, esto representa más de **34,800 kWh adicionales** facturados a tarifa industrial plena.\n"+
				"2. **Fuerte Penalidad por Energía Reactiva (FP 0.74)**: Al caer el factor de potencia a 0.74, casi un 26%% de la energía que pasa por los cables es reactiva inductiva ('espuma'). Los operadores de red aplican penalizaciones económicas por transporte de reactiva según regulación, lo que incrementa el costo unitario de tu recibo.\n\n"+
				"**Estimación**: Resolver este punto a tiempo mediante la inspección técnica de Bia evita sobrecostos millonarios en tu próximo corte de facturación.", userName),
			KeyTakeaways: []string{
				"+1,160 kWh diarios de sobreconsumo activo no justificado",
				"Penalización tarifaria por bajo factor de potencia (0.74)",
				"Atención inmediata protege el presupuesto energético del mes",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Solicitar visita técnica para M-109",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Inspección termográfica para eliminar sobrecostos.",
				},
			},
			FollowUpQuestions: []string{
				"¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
				"¿Qué debo verificar antes de que llegue la visita técnica?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// F. Protocolo previo a la visita técnica ("verificar", "revisar", "preparar", "antes de que llegue", "visita técnica", "inspección", "protocolo")
	if strings.Contains(lowerQ, "verificar") || strings.Contains(lowerQ, "revisar") || strings.Contains(lowerQ, "preparar") || strings.Contains(lowerQ, "antes") || strings.Contains(lowerQ, "visita técnica") || strings.Contains(lowerQ, "visita tecnica") || strings.Contains(lowerQ, "inspección") || strings.Contains(lowerQ, "inspeccion") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, antes de que el equipo de ingenieros de Bia arribe a la planta para inspeccionar el **medidor M-109**, te recomiendo esta lista de verificación segura y no técnica:\n\n"+
				"1. **Revisar la bitácora operativa de planta**: Confirma si durante los días 12 al 14 de septiembre se conectó maquinaria pesada temporal, motores de respaldo o bancos de prueba no programados.\n"+
				"2. **Inspección visual y olfativa exterior (sin abrir celdas vivas)**: Verifica desde el pasillo si en el tablero general o la celda del transformador se percibe olor a plástico caliente, ozono o vibración acústica anómala.\n"+
				"3. **Despejar el acceso físico a la subestación**: Asegura que el transformador 1 y el tablero de distribución principal tengan pasillos despejados y llaves disponibles para el ingreso seguro del personal técnico.\n"+
				"4. **Tener disponible el diagrama unifilar**: Facilitará al ingeniero de Bia contrastar las cargas teóricas con la lectura real de la cámara termográfica y el analizador de redes.", userName),
			KeyTakeaways: []string{
				"Verificar bitácora de maquinaria conectada sin reporte oficial",
				"Inspección olfativa y visual desde el exterior de tableros (sin tocar componentes vivos)",
				"Garantizar acceso físico y llaves de subestación para el equipo de Bia",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Confirmar solicitud de visita técnica (M-109)",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Coordinar fecha y franja horaria con los ingenieros de Bia.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cuánto dinero extra me puede costar este incremento?",
				"¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// G. Apagar máquinas / Parar producción
	if strings.Contains(lowerQ, "apagar") || strings.Contains(lowerQ, "detener") || strings.Contains(lowerQ, "parar") {
		if meterID == "M-112" || strings.Contains(lowerQ, "112") || strings.Contains(lowerQ, "sensor") {
			return copilot.Answer{
				Answer: fmt.Sprintf("No, %s. **No necesitas apagar ninguna máquina en el área M-112** (Inyección y Moldeo).\n\nTus equipos de inyección operan con total normalidad, seguridad y eficiencia. La oscilación en la gráfica es exclusivamente ruido en la señal del sensor de voltaje Modbus (analogía del velocímetro que oscila). Tu producción no corre ningún peligro y puede continuar sin interrupciones.", userName),
				KeyTakeaways: []string{
					"No requiere detener máquinas de inyección",
					"La producción se mantiene nominal y segura",
					"La falla es de telemetría del sensor, no de maquinaria",
				},
				FollowUpQuestions: []string{
					"¿Bia puede corregir esta medición de forma remota?",
					"¿Esta falla de sensor afectará lo que pago en mi factura de energía?",
				},
				Source:    "deterministic:copilot",
				ContextID: "M-112",
			}, nil
		}

		return copilot.Answer{
			Answer: fmt.Sprintf("%s, en el medidor **M-109** (Subestación Principal) no se recomienda apagar la planta intempestivamente sin previo aviso, pero **sí debes coordinar con el jefe de turno** para identificar qué carga pesada está jalando 424 Amperios de forma continua y desconectar cargas secundarias no esenciales hasta que se realice la inspección termográfica.", userName),
			KeyTakeaways: []string{
				"No apagar toda la planta sin coordinación previa",
				"Identificar cargas secundarias desconectables para bajar corriente",
				"Esperar la inspección termográfica de tableros de Bia",
			},
			FollowUpQuestions: []string{
				"¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
				"¿Qué debo verificar antes de que llegue la visita técnica?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// H. Corrección remota de Bia
	if strings.Contains(lowerQ, "remoto") || strings.Contains(lowerQ, "remota") || strings.Contains(lowerQ, "bia puede") || strings.Contains(lowerQ, "corregir") {
		return copilot.Answer{
			Answer: fmt.Sprintf("Sí, %s. En casos como el medidor **M-112**, el equipo de Bia puede aplicar filtros digitales y recalibrar el transductor de telemetría de forma remota sin costo y sin necesidad de abrir tableros en la planta.\n\nNuestros ingenieros ajustan el filtro de ruido en el canal Modbus para eliminar lecturas espurias.", userName),
			KeyTakeaways: []string{
				"Corrección remota disponible para el sensor M-112",
				"Sin interrupción de operaciones ni costos adicionales",
			},
			FollowUpQuestions: []string{
				"¿Esta falla de sensor afectará lo que pago en mi factura de energía?",
				"¿Tengo que apagar alguna máquina en el área M-112?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-112",
		}, nil
	}

	// I. Ranking de consumo / Top 3 medidores
	if strings.Contains(lowerQ, "3 medidores") || strings.Contains(lowerQ, "tres medidores") || strings.Contains(lowerQ, "mayor consumo") || strings.Contains(lowerQ, "más consumen") || strings.Contains(lowerQ, "mas consumen") || strings.Contains(lowerQ, "ranking") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, los 3 medidores con mayor consumo de energía en tu planta son:\n\n"+
				"1. **M-109 (Subestación Principal · Transformador 1)**: ~2,208 kWh/día (en sobrecarga crítica; duplicó su baseline habitual).\n"+
				"2. **M-104 (Línea de Producción · Envasado)**: ~1,726 kWh/día (aumento del +47.5%% justificado por la nueva línea de envasado).\n"+
				"3. **M-103 (Hornos de Tratamiento Térmico · Zona 2)**: ~850 kWh/día (operación térmica continua nominal en régimen eficiente).\n\n"+
				"Entre estos tres puntos se concentra más del 65%% de toda la energía consumida en tu fábrica.", userName),
			KeyTakeaways: []string{
				"M-109, M-104 y M-103 concentran más del 65% del consumo total",
				"M-109 es el único punto con sobrecosto crítico no justificado",
				"M-104 y M-103 operan de forma normal acorde a su carga productiva",
			},
			FollowUpQuestions: []string{
				"¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?",
				"¿Cómo puedo reducir los costos de energía este mes?",
			},
			Source:    "deterministic:copilot",
			ContextID: "top_consumers",
		}, nil
	}

	// J. Reducir costos / Ahorro este mes
	if strings.Contains(lowerQ, "reducir") || strings.Contains(lowerQ, "ahorrar") || strings.Contains(lowerQ, "optimizar") || strings.Contains(lowerQ, "menos pagar") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, para reducir de inmediato la factura energética este mes, te recomiendo estas 3 acciones de alto impacto:\n\n"+
				"1. **Controlar la sobrecorriente en M-109**: Es la fuga financiera número 1 de la planta. Normalizar los 424 Amperios y corregir el factor de potencia (0.74) evitará decenas de miles de kWh extra y costosas penalizaciones de energía reactiva impuestas por el operador de red.\n"+
				"2. **Desplazar cargas térmicas fuera de horario pico**: Cargas como los hornos (M-103) y precalentadores pueden programar sus arranques en horario valle donde el costo por kWh es menor.\n"+
				"3. **Confirmar la nueva línea base de M-104**: Asegurar que la nueva línea de envasado esté dentro de la capacidad contratada con tu comercializador para no sobrepasar la potencia máxima acordada.", userName),
			KeyTakeaways: []string{
				"Prioridad 1: Mitigar la sobrecarga y penalidad reactiva en M-109",
				"Prioridad 2: Desplazar cargas térmicas pesadas fuera de horario punta",
				"Prioridad 3: Calibrar contratos de potencia para la nueva línea M-104",
			},
			FollowUpQuestions: []string{
				"¿Cuánto dinero extra me puede costar este incremento en M-109?",
				"¿Qué porcentaje de la energía se consume en horario pico?",
			},
			Source:    "deterministic:copilot",
			ContextID: "cost_reduction",
		}, nil
	}

	// K. Horario pico / Punta / Tarifa
	if strings.Contains(lowerQ, "horario pico") || strings.Contains(lowerQ, "horario punta") || strings.Contains(lowerQ, "punta") || strings.Contains(lowerQ, "pico") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, en el sector industrial las horas pico o de punta (generalmente entre las 18:00 y las 22:00 h según tu operador) tienen una tarifa por kWh significativamente más alta y penalizan la demanda máxima.\n\n"+
				"En tu planta, el 28%% del consumo total se concentra en estas 4 horas. Desplazar ciclos de arranque de motores pesados hacia horarios diurnos o nocturnos puede reducir hasta un 15%% el costo de demanda en la factura.", userName),
			KeyTakeaways: []string{
				"Horario pico (18:00 - 22:00h) con tarifa y potencia castigada",
				"28% del consumo de la fábrica ocurre en ventana punta",
				"Desplazamiento de arranques genera ahorros directos de hasta 15%",
			},
			FollowUpQuestions: []string{
				"¿Cuáles son los 3 medidores con mayor consumo de la planta?",
				"¿Cómo puedo reducir los costos de energía este mes?",
			},
			Source:    "deterministic:copilot",
			ContextID: "peak_hours",
		}, nil
	}

	// L. Medidores que requieren atención inmediata
	if strings.Contains(lowerQ, "requieren mi atención") || strings.Contains(lowerQ, "requieren atencion") || strings.Contains(lowerQ, "atención inmediata") || strings.Contains(lowerQ, "atencion inmediata") || strings.Contains(lowerQ, "urgente") || strings.Contains(lowerQ, "cuáles medidores") || strings.Contains(lowerQ, "cuales medidores") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, de los 12 medidores de tu planta industrial, únicamente **2 puntos** requieren tu atención hoy:\n\n"+
				"1. **M-109 (Subestación Principal · Transformador 1)**: PRIORIDAD CRÍTICA. Sobrecarga sostenida de 424 Amperios (+110.7%%) con calentamiento por efecto Joule y penalización reactiva (FP 0.74). Requiere inspección termográfica prioritaria.\n"+
				"2. **M-112 (Inyección y Moldeo)**: PRIORIDAD MEDIA (Calidad de datos). Sensor de voltaje Modbus oscilando por ruido; tus máquinas operan con normalidad y Bia lo calibrará de forma remota.\n\n"+
				"Los otros 10 medidores operan de manera 100%% nominal, segura y eficiente.", userName),
			KeyTakeaways: []string{
				"M-109 es la única anomalía con riesgo de sobrecosto y sobrecalentamiento",
				"M-112 es un problema de sensor, no de maquinaria ni de facturación",
				"10 de 12 medidores operan con total normalidad",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Solicitar visita técnica para M-109",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Atiende la incidencia más crítica de la planta.",
				},
			},
			FollowUpQuestions: []string{
				"¿Por qué aumentó tanto el consumo de M-109 en palabras sencillas?",
				"¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
			},
			Source:    "deterministic:copilot",
			ContextID: "anomalies_attention",
		}, nil
	}

	// M. Actualización de línea base (M-104)
	if strings.Contains(lowerQ, "actualizo la línea base") || strings.Contains(lowerQ, "actualizo la linea base") || strings.Contains(lowerQ, "línea base") || strings.Contains(lowerQ, "linea base") || strings.Contains(lowerQ, "baseline") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, para actualizar la línea base (por ejemplo en el medidor **M-104** tras activar la nueva línea de producción):\n\n"+
				"El sistema de IA de Bia procesa automáticamente una ventana de 7 días continuos de operación para recalibrar los estadísticos robustos (mediana y MAD). Esto asimila el nuevo consumo productivo como el nuevo estándar nominal, evitando que se disparen falsas alarmas en el futuro.", userName),
			KeyTakeaways: []string{
				"La IA recalibra la línea base tras 7 días continuos de registro",
				"Utiliza mediana y MAD para evitar distorsiones por picos espurios",
				"No requiere programación compleja por parte del operador",
			},
			FollowUpQuestions: []string{
				"¿Este nuevo consumo de M-104 está dentro del presupuesto esperado?",
				"¿Cuáles son los 3 medidores con mayor consumo de la planta?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-104",
		}, nil
	}

	// N. Paradas programadas y exclusión de reportes (M-106)
	if strings.Contains(lowerQ, "excluye") || strings.Contains(lowerQ, "falsos positivos") || strings.Contains(lowerQ, "parada") || strings.Contains(lowerQ, "caldera") {
		return copilot.Answer{
			Answer: fmt.Sprintf("%s, en el medidor **M-106** (Circuito Térmico de Caldera) la caída a cero consumo no es una falla técnica:\n\n"+
				"**Analogía amigable**: Es como apagar el motor del automóvil para cambiarle el aceite y hacerle afinación: una pausa planificada indispensable para alargar su vida útil.\n\n"+
				"La IA cruzó la telemetría con la bitácora de mantenimiento y clasificó el evento como Falso Positivo, excluyéndolo del cálculo estadístico para que no distorsione tus reportes futuros.", userName),
			KeyTakeaways: []string{
				"Caída temporal explicada por mantenimiento de calderas en bitácora",
				"Consumo restablecido al nivel normal tras la parada",
				"La IA excluye automáticamente este periodo de futuros cálculos",
			},
			FollowUpQuestions: []string{
				"¿Cómo registro futuros mantenimientos en el calendario?",
				"¿Cuáles medidores requieren mi atención inmediata hoy?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-106",
		}, nil
	}

	// =========================================================================
	// EXPLICACIONES POR MEDIDOR (CUANDO NO COINCIDIÓ CON UN INTENTO ANTERIOR)
	// =========================================================================

	// 1. Caso M-109 (Sobrecarga Crítica / Efecto Joule I²R / Factor de Potencia / Analogía Manguera y Cerveza)
	if meterID == "M-109" || strings.Contains(lowerQ, "109") || strings.Contains(lowerQ, "sobrecarga") {
		var intro string
		if hasHistory {
			intro = fmt.Sprintf("Respecto al **medidor M-109** (Subestación Principal), %s:", userName)
		} else {
			intro = fmt.Sprintf("Hola %s. Como especialista en energía industrial de Bia, analicé el **medidor M-109** (Subestación Principal):", userName)
		}

		answer := fmt.Sprintf("%s\n\n"+
			"Técnicamente lo que sucede es una **sobrecorriente crítica sostenida**: la corriente eléctrica subió a **424 Amperios**, cuando lo habitual según el baseline calibrado son 201 A (+110.5%% de sobrecarga), duplicando el consumo habitual (+110.7%%).\n\n"+
			"**¿Cómo entenderlo de forma muy sencilla?**\n"+
			"• **Efecto manguera y calor (Efecto Joule)**: Imagina una manguera de agua diseñada para 200 litros/minuto por la que repentinamente estás forzando 424 litros/minuto. Por física eléctrica (*efecto Joule*, pérdidas $I^2R$), los conductores y el transformador disipan una enorme cantidad de calor. Esto no es solo consumo en la factura: es riesgo de derretir el aislamiento de los cables, provocar un cortocircuito o conato de incendio en la subestación y disparar las protecciones generales apagando la planta.\n"+
			"• **Pérdidas por Factor de Potencia (0.74)**: Piensa en un vaso de cerveza: el líquido es la energía activa que hace el trabajo útil en tus máquinas, y la espuma es la energía reactiva que necesitan los motores para magnetizarse. Un factor de potencia de 0.74 significa que casi un 26%% de lo que pasa por los cables es 'pura espuma', saturando la instalación y provocando un fuerte recargo económico del operador de red en tu factura.\n\n"+
			"**Recomendación experta**: Solicitar inspección termográfica prioritaria en tableros y revisar el banco de condensadores.", intro)

		return copilot.Answer{
			Answer: answer,
			KeyTakeaways: []string{
				"Corriente duplicada a 424 A: severo calentamiento térmico por efecto Joule (I²R)",
				"Factor de potencia degradado a 0.74: recargo por energía reactiva en tu factura",
				"Recomendado solicitar visita técnica prioritaria para inspección termográfica",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "request_visit_m109",
					Label:       "Solicitar visita técnica para M-109",
					ActionType:  "technical_visit",
					Payload:     "M-109",
					Description: "Un especialista técnico de Bia inspeccionará tu medidor y cargas en menos de 48 horas.",
				},
				{
					ID:          "view_telemetry_m109",
					Label:       "Ver consumo y gráficos de M-109",
					ActionType:  "view_meter",
					Payload:     "M-109",
					Description: "Inspecciona la gráfica de telemetría de 14 días y anomalías.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cuánto dinero extra me puede costar este incremento?",
				"¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
				"¿Qué debo verificar antes de que llegue la visita técnica?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// 2. Caso M-112 (Problema de Sensor / Calidad de Datos / Analogía Velocímetro)
	if meterID == "M-112" || strings.Contains(lowerQ, "112") || strings.Contains(lowerQ, "sensor") || strings.Contains(lowerQ, "calidad") {
		var intro string
		if hasHistory {
			intro = fmt.Sprintf("%s, en el **medidor M-112** (Inyección y Moldeo) la situación técnica es totalmente diferente:", userName)
		} else {
			intro = fmt.Sprintf("Hola %s. En el **medidor M-112** (Inyección y Moldeo) tus máquinas están en perfecto estado:", userName)
		}

		answer := fmt.Sprintf("%s\n\n"+
			"El consumo de energía real es completamente normal (la variación es de apenas +0.4%%).\n\n"+
			"**¿Qué está sucediendo técnicamente?**\n"+
			"La anomalía es exclusivamente de **Calidad de Datos / Telemetría**: el transductor de voltaje o el enlace de comunicación Modbus está captando ruido electromagnético, lo que produce oscilaciones espurias en la gráfica durante 16 horas.\n\n"+
			"**Analogía amigable**: Imagina que conduces un automóvil a una velocidad perfecta y constante de 60 km/h en carretera, pero la aguja del velocímetro en el tablero está parpadeando erráticamente entre 20 y 120 km/h. Tu motor, frenos y transmisión funcionan de maravilla; el único desperfecto es el indicador de la pantalla.\n\n"+
			"**¿Qué debes hacer?**\n"+
			"No detengas la producción ni apagues ninguna máquina. Bia programará una calibración remota o revisión del sensor para garantizar que los registros sigan siendo 100%% exactos.", intro)

		return copilot.Answer{
			Answer: answer,
			KeyTakeaways: []string{
				"Tus máquinas de inyección operan con total normalidad; no hay riesgo mecánico",
				"Inconsistencia producida por ruido de telemetría en el transductor de voltaje",
				"No genera sobrecostos ni requiere detener la producción de la planta",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "view_meter_m112",
					Label:       "Revisar medidor M-112",
					ActionType:  "view_meter",
					Payload:     "M-112",
					Description: "Observar las señales de telemetría reportadas por el medidor.",
				},
			},
			FollowUpQuestions: []string{
				"¿Esta falla de sensor afectará lo que pago en mi factura de energía?",
				"¿Tengo que apagar alguna máquina en el área M-112?",
				"¿Bia puede corregir esta medición de forma remota?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-112",
		}, nil
	}

	// 3. Caso M-104 (Aumento Justificado / Línea de Producción / Analogía Segundo Horno)
	if meterID == "M-104" || strings.Contains(lowerQ, "104") || strings.Contains(lowerQ, "envasado") {
		var intro string
		if hasHistory {
			intro = fmt.Sprintf("%s, el aumento de +47.5%% en el **medidor M-104** (Línea de Envasado) está plenamente justificado:", userName)
		} else {
			intro = fmt.Sprintf("Hola %s. Te explico el aumento de +47.5%% en el **medidor M-104** (Línea de Envasado):", userName)
		}

		answer := fmt.Sprintf("%s\n\n"+
			"Este incremento está 100%% justificado técnicamente: coincide exactamente con la puesta en marcha de la nueva línea de producción registrada en la bitácora operativa.\n\n"+
			"**¿Qué sucede a nivel eléctrico?**\n"+
			"El perfil de voltaje se mantiene en 220 V con perfecta estabilidad y la corriente se elevó de 135 A a 198 A de manera simétrica y con factor de potencia óptimo. Es energía productiva genuina.\n\n"+
			"**Analogía sencilla**: Es como encender un segundo horno en una panadería porque aumentaron los pedidos de clientes: el consumo sube, pero porque estás produciendo y vendiendo más, no por una fuga eléctrica ni desperdicio.\n\n"+
			"**Siguiente paso**: Confirmar este nuevo régimen en el sistema para recalibrar la línea base y evitar falsas alarmas.", intro)

		return copilot.Answer{
			Answer: answer,
			KeyTakeaways: []string{
				"Incremento plenamente justificado por la nueva línea de producción",
				"Parámetros eléctricos equilibrados y dentro de norma técnica",
				"Se actualiza el baseline en el sistema para asimilar el nuevo nivel de consumo",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "acknowledge_m104",
					Label:       "Confirmar nuevo nivel de producción",
					ActionType:  "acknowledge_anomaly",
					Payload:     "M-104",
					Description: "Registra la nueva línea base para evitar falsas alarmas futuras.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cómo actualizo la línea base para esta nueva línea?",
				"¿Este nuevo consumo está dentro del presupuesto esperado?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-104",
		}, nil
	}

	// 4. Caso M-106 (Falso Positivo / Parada Programada / Analogía Cambio de Aceite)
	if meterID == "M-106" || strings.Contains(lowerQ, "106") {
		var intro string
		if hasHistory {
			intro = fmt.Sprintf("%s, en el **medidor M-106** (Circuito Térmico de Caldera) la lectura temporal es normal:", userName)
		} else {
			intro = fmt.Sprintf("Hola %s. En el **medidor M-106** (Circuito Térmico de Caldera) la lectura temporal es normal:", userName)
		}

		answer := fmt.Sprintf("%s\n\n"+
			"El consumo cayó temporalmente un -99.5%% durante 6 horas. La IA lo clasificó correctamente como 'Falso Positivo' al cruzar la telemetría con el registro de mantenimiento preventivo de calderas agendado en planta.\n\n"+
			"**Analogía amigable**: Es el equivalente exacto a apagar el motor de un vehículo para hacerle su cambio de aceite y filtros de rutina: no es una falla mecánica, sino una pausa planificada para alargar la vida útil del equipo.\n\n"+
			"Una vez concluidas las labores, la caldera retomó su carga normal y la IA excluyó este periodo para no distorsionar tus reportes futuros.", intro)

		return copilot.Answer{
			Answer: answer,
			KeyTakeaways: []string{
				"Caída temporal explicada por mantenimiento preventivo de calderas",
				"Consumo restablecido a régimen nominal tras la parada",
				"No requiere ninguna acción correctiva",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "view_meter_m106",
					Label:       "Ver historial de M-106",
					ActionType:  "view_meter",
					Payload:     "M-106",
					Description: "Consulta la gráfica de recuperación del medidor tras la parada.",
				},
			},
			FollowUpQuestions: []string{
				"¿La IA excluye automáticamente estas paradas del cálculo futuro?",
				"¿Cómo registro futuros mantenimientos en el calendario?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-106",
		}, nil
	}

	// 5. Caso Medidor General
	if meterID != "" && q.ContextType == copilot.ContextMeter {
		var intro string
		if hasHistory {
			intro = fmt.Sprintf("%s, evaluando el medidor **%s**:", userName, meterID)
		} else {
			intro = fmt.Sprintf("Hola %s. Evaluando el medidor **%s**:", userName, meterID)
		}

		return copilot.Answer{
			Answer: fmt.Sprintf("%s\n\n"+
				"El equipo presenta una operación nominal estable, sin desviaciones estadísticas ni anomalías eléctricas registradas.\n\n"+
				"• **Consumo**: Se mantiene alineado con la línea base histórica del área.\n"+
				"• **Salud eléctrica**: Factores de potencia y niveles de corriente dentro de los márgenes óptimos de eficiencia.\n\n"+
				"¿Deseas comparar este punto de medición contra otros sectores de la planta?", intro),
			KeyTakeaways: []string{
				fmt.Sprintf("Medidor %s operando en condiciones estándar", meterID),
				"Telemetría dentro de los rangos de baseline esperados",
				"No requiere acciones correctivas en este momento",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "view_meter_" + meterID,
					Label:       "Ver consumo y gráficos de " + meterID,
					ActionType:  "view_meter",
					Payload:     meterID,
					Description: "Inspecciona la gráfica de telemetría de este medidor.",
				},
			},
			FollowUpQuestions: []string{
				fmt.Sprintf("¿Cuál es el consumo promedio diario de %s?", meterID),
				"¿Cómo se compara con el resto de la planta?",
			},
			Source:    "deterministic:copilot",
			ContextID: meterID,
		}, nil
	}

	// 6. Contexto General de Planta (Fallback por defecto)
	var intro string
	if hasHistory {
		intro = fmt.Sprintf("%s, sobre tu consulta (\"%s\"):", userName, q.Question)
	} else {
		intro = fmt.Sprintf("Hola %s. Como especialista en energía de Bia, sobre tu consulta (\"%s\"):", userName, q.Question)
	}

	return copilot.Answer{
		Answer: fmt.Sprintf("%s\n\n"+
			"Supervisamos continuamente los %d puntos de medición de tu planta industrial en tiempo real.\n\n"+
			"• **Operación General**: 10 medidores operan de forma óptima y eficiente dentro de sus límites nominales.\n"+
			"• **Atención Prioritaria (M-109)**: Sobrecarga crítica (+110.7%%) con corriente de 424 A y bajo factor de potencia (0.74) en la subestación principal.\n"+
			"• **Ruido en Sensor (M-112)**: Falla de medición en sensor Modbus, sin afectación mecánica a las inyectoras.\n\n"+
			"¿Deseas programar una visita técnica para revisar tableros o examinar algún medidor en particular?", intro, totalMeters),
		KeyTakeaways: []string{
			"Operación global estable salvo por la sobrecarga del medidor M-109",
			fmt.Sprintf("Bia supervisa en tiempo real %d lecturas para proteger tu presupuesto", totalReadings),
			"Soporte técnico preventivo disponible para inspección de tableros",
		},
		SuggestedActions: []copilot.Action{
			{
				ID:          "request_visit",
				Label:       "Solicitar visita técnica",
				ActionType:  "technical_visit",
				Payload:     "M-109",
				Description: "Programa una revisión en sitio con un ingeniero de Bia Energy.",
			},
		},
		FollowUpQuestions: []string{
			"¿Cómo puedo reducir la factura energética este mes?",
			"¿Cuáles son los 3 medidores con mayor consumo de la planta?",
			"¿Cuáles medidores requieren mi atención inmediata hoy?",
		},
		Source:    "deterministic:copilot",
		ContextID: q.ContextID,
	}, nil
}
