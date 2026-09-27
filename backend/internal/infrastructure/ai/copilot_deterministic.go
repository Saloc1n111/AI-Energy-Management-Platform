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

func (d *CopilotDeterministic) ExplainQuery(_ context.Context, q copilot.Question, extra map[string]interface{}) (copilot.Answer, error) {
	lowerQ := strings.ToLower(q.Question)
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

	// 1. Caso M-109 (Aumento Inusual / Anomalía Real)
	if meterID == "M-109" || strings.Contains(lowerQ, "109") {
		return copilot.Answer{
			Answer: "Detectamos un incremento inusual y sostenido de más del doble (+110.7%) en el consumo eléctrico del medidor M-109 durante los últimos días, sin ningún reporte de mantenimiento ni cambio de turno.\n\n" +
				"¿Qué significa esto para tu negocio?\n" +
				"• Si no aumentaste tu producción ni encendiste nuevas máquinas, este consumo extra no justificado representa un costo imprevisto en tu próxima factura y podría alertar sobre un equipo trabajando forzado o un riesgo eléctrico.\n" +
				"• Te sugerimos revisar en planta si hubo horas extras no registradas. Si confirmas que tu operación sigue igual, solicita una visita técnica inmediata de Bia para inspeccionar el tablero y descartar fallas.",
			KeyTakeaways: []string{
				"Consumo duplicado (+110.7%) sin justificación operativa reportada",
				"Riesgo de sobrecosto en factura y sobrecalentamiento en tableros",
				"Recomendado solicitar visita técnica inmediata si no reconoces el cambio",
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
					Description: "Inspecciona la gráfica de consumo real contra lo esperado.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cuánto dinero extra me puede costar este aumento en M-109?",
				"¿Qué equipos de mi planta están conectados al medidor M-109?",
				"¿Qué debo verificar antes de que llegue el técnico de Bia?",
			},
			Source:    "deterministic:copilot",
			ContextID: "M-109",
		}, nil
	}

	// 2. Caso M-112 (Problema de Sensor / Calidad de Datos)
	if meterID == "M-112" || strings.Contains(lowerQ, "112") || strings.Contains(lowerQ, "calidad") {
		return copilot.Answer{
			Answer: "En el medidor M-112 tu consumo de energía real es completamente normal (la variación es de apenas 0.4%).\n\n" +
				"El problema que detectamos no está en tus máquinas ni en tus procesos, sino en la telemetría del sensor (el transductor de voltaje presenta lecturas erráticas durante 16 horas).\n\n" +
				"¿Qué debes hacer?\n" +
				"No necesitas detener ninguna máquina ni cambiar tu operación. Bia programará una calibración remota o revisión del equipo de medición para garantizar que tus datos sigan siendo 100% exactos.",
			KeyTakeaways: []string{
				"Tus máquinas operan normalmente; el consumo no ha subido",
				"La inconsistencia proviene del sensor de medición, no de tu instalación",
				"No hay riesgo de interrupción operativa",
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

	// 3. Caso M-104 (Aumento Justificado / Línea de Producción)
	if meterID == "M-104" || strings.Contains(lowerQ, "104") || strings.Contains(lowerQ, "línea") {
		return copilot.Answer{
			Answer: "El medidor M-104 registró un aumento de +47.5% en su consumo, pero este incremento está 100% justificado y es una buena noticia: coincide exactamente con la activación de la nueva línea de producción registrada en planta.\n\n" +
				"Todos los parámetros eléctricos son estables y seguros. Lo único que requiere el sistema es confirmar este nuevo nivel operativo para recalibrar la línea base y que la plataforma no vuelva a alertar sobre este consumo productivo.",
			KeyTakeaways: []string{
				"Aumento coherente y esperado por la nueva línea de producción",
				"Instalación eléctrica trabajando de forma segura y nominal",
				"Recomendado actualizar el perfil base de consumo en el sistema",
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

	// 4. Caso M-106 (Falso Positivo / Parada Programada)
	if meterID == "M-106" || strings.Contains(lowerQ, "106") || strings.Contains(lowerQ, "parada") {
		return copilot.Answer{
			Answer: "El medidor M-106 muestra una caída temporal de consumo (-99.5%) durante 6 horas. Esto fue catalogado como 'Falso Positivo' porque coincide exactamente con el mantenimiento preventivo de calderas programado en el calendario.\n\n" +
				"No representa ninguna falla ni requiere que realices ninguna acción: el consumo retornó a su nivel habitual una vez concluidas las labores.",
			KeyTakeaways: []string{
				"Caída explicada por mantenimiento de calderas planificado",
				"Consumo restablecido al nivel normal tras la parada",
				"No requiere intervención técnica",
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

	// 4b. Caso Medidor General / Dinámico
	if meterID != "" && q.ContextType == copilot.ContextMeter {
		return copilot.Answer{
			Answer: fmt.Sprintf("Analizando el medidor **%s**: el equipo presenta una operación nominal estable, sin desviaciones estadísticas ni anomalías eléctricas registradas.\n\n"+
				"• **Consumo**: Se mantiene alineado con la línea base histórica del área.\n"+
				"• **Estado**: Operación óptima y eficiente sin requerimiento de intervención técnica inmediata.\n\n"+
				"¿Deseas comparar este punto de medición contra otros sectores de la planta?", meterID),
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

	// 5. Contexto KPI Consumo Total
	if q.ContextType == copilot.ContextKPI && (q.ContextID == "total_consumption" || strings.Contains(lowerQ, "consumo total")) {
		return copilot.Answer{
			Answer: fmt.Sprintf("El consumo acumulado de tus %d medidores en los últimos 14 días es de aproximadamente 155 MWh (un 2.5%% superior al periodo previo).\n\n"+
				"El 70%% de este incremento global proviene principalmente del medidor M-109, donde se registró un alza de más del doble sin justificar. Los otros medidores operan de forma estable dentro de sus rangos normales.", totalMeters),
			KeyTakeaways: []string{
				"155 MWh consumidos en 14 días (+2.5% respecto a baseline)",
				"El medidor M-109 concentra la gran mayoría del sobreconsumo",
				"Los demás medidores mantienen patrones de alta eficiencia",
			},
			SuggestedActions: []copilot.Action{
				{
					ID:          "inspect_m109",
					Label:       "Investigar medidor M-109",
					ActionType:  "view_meter",
					Payload:     "M-109",
					Description: "Revisa el medidor con mayor incidencia de sobrecosto.",
				},
			},
			FollowUpQuestions: []string{
				"¿Cuánto representa este consumo total en costo estimado?",
				"¿Cuáles son los 3 medidores con mayor consumo de la planta?",
				"¿Qué porcentaje de la energía se gasta en horario punta?",
			},
			Source:    "deterministic:copilot",
			ContextID: "total_consumption",
		}, nil
	}

	// 6. Contexto KPI Anomalías / Alta Prioridad
	if q.ContextType == copilot.ContextKPI && (q.ContextID == "anomalies" || q.ContextID == "high_priority" || strings.Contains(lowerQ, "alta prioridad")) {
		return copilot.Answer{
			Answer: "El sistema detectó 4 anomalías en total, pero únicamente 2 requieren tu atención prioritaria hoy:\n\n" +
				"1. Medidor M-109 (Alta Prioridad): Aumento inesperado de +110.7% sin evento que lo explique. Recomendamos inspección en sitio o visita técnica.\n" +
				"2. Medidor M-112 (Alta Prioridad): Falla de medición en el sensor, no de tus máquinas.\n\n" +
				"Las otras 2 detecciones (M-104 y M-106) ya están justificadas y no representan ningún riesgo financiero ni operacional.",
			KeyTakeaways: []string{
				"Solo 2 de las 4 alertas necesitan acción operativa",
				"M-109 es la única con posible riesgo de sobrecosto y falla",
				"M-104 y M-106 son operaciones normales (línea nueva y mantenimiento)",
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
				"¿Qué consecuencias tiene no atender la alerta de M-109 hoy?",
				"¿Puedo silenciar las alertas justificadas como M-106?",
			},
			Source:    "deterministic:copilot",
			ContextID: "high_priority",
		}, nil
	}

	// 7. Saludos y Bienvenida (Hola, Buenos días, etc.)
	if lowerQ == "hola" || strings.HasPrefix(lowerQ, "hola") || strings.Contains(lowerQ, "buenos d") || strings.Contains(lowerQ, "buenas t") {
		return copilot.Answer{
			Answer: "¡Hola! Soy tu **Asesor de Inteligencia Energética de Bia**.\n\n" +
				"Estoy aquí para responder cualquier duda sobre tus consumos, costos, medidores y alertas en lenguaje 100% claro y sin tecnicismos.\n\n" +
				"Actualmente el punto prioritario que requiere atención en tu planta es el **medidor M-109** (Subestación Principal), que duplicó su consumo sin justificación operativa.\n\n" +
				"¿Qué te gustaría consultar hoy?",
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
				{
					ID:          "view_meter_m109",
					Label:       "Ver detalles de M-109",
					ActionType:  "view_meter",
					Payload:     "M-109",
					Description: "Revisa el consumo y anomalías de la subestación principal.",
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

	// 8. Preguntas sobre Asesoría Integral o significado de la vista
	if strings.Contains(lowerQ, "asesor") || strings.Contains(lowerQ, "significa lo que estoy viendo") || strings.Contains(lowerQ, "que estoy viendo") {
		return copilot.Answer{
			Answer: fmt.Sprintf("Estás en el centro de **Asesoría Integral de Energía Bia**.\n\n"+
				"Nuestra plataforma supervisa continuamente los %d medidores de tu planta industrial y traduce la telemetría a decisiones de negocio claras:\n\n"+
				"• **Estado General**: La gran mayoría de tus medidores operan de forma óptima y eficiente.\n"+
				"• **Atención Prioritaria (M-109)**: Se detectó un incremento inusual de +110.7%% de consumo sin reporte de producción.\n"+
				"• **Falla de Medición (M-112)**: Hay lecturas erráticas en el sensor, pero tus máquinas operan con total normalidad.\n\n"+
				"¿Deseas que te ayude a programar una visita técnica para revisar M-109 o consultar otro punto de tu planta?", totalMeters),
			KeyTakeaways: []string{
				fmt.Sprintf("Supervisión activa sobre %d medidores", totalMeters),
				"M-109 genera un sobrecosto proyectado no justificado",
				"M-112 es un problema de sensor, no de tus máquinas ni de tu producción",
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
				"¿Qué acción me recomiendas tomar ahora mismo?",
				"¿Hay algún riesgo financiero u operativo en este dato?",
				"¿Cómo puedo reducir la factura energética este mes?",
			},
			Source:    "deterministic:copilot",
			ContextID: q.ContextID,
		}, nil
	}

	// 9. Contexto General / Asesoría Energética
	return copilot.Answer{
		Answer: fmt.Sprintf("Hola. Como asesor de Bia Energy, analizo continuamente los %d medidores de tu planta.\n\n"+
			"Sobre tu consulta (\"%s\"): Actualmente el punto neurálgico que debes vigilar es el medidor M-109, donde se ha duplicado el consumo sin reporte de producción. Los demás medidores se encuentran en condición controlada.\n\n"+
			"¿Deseas que te ayude a programar una visita técnica o prefieres revisar el desglose de consumo por áreas?", totalMeters, q.Question),
		KeyTakeaways: []string{
			"Operación global estable salvo por el medidor M-109",
			fmt.Sprintf("Bia supervisa en tiempo real %d lecturas para proteger tu presupuesto", totalReadings),
			"Soporte técnico disponible 24/7 para inspección de tableros",
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
			"¿Qué medidor consume más energía en la planta?",
			"¿Qué ventajas tengo con el servicio de Bia Energy?",
		},
		Source:    "deterministic:copilot",
		ContextID: q.ContextID,
	}, nil
}
