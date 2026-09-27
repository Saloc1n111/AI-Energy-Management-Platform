// Package ai contiene los adaptadores que redactan explicaciones de anomalías.
package ai

import (
	"context"
	"fmt"
	"math"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
)

const SourceDeterministic = "deterministic"

// Deterministic redacta explicaciones con plantillas a partir de la evidencia.
// Es el respaldo cuando no hay API key o el LLM falla: la plataforma nunca se queda sin explicación.
type Deterministic struct{}

func NewDeterministic() *Deterministic { return &Deterministic{} }

func (*Deterministic) Name() string { return SourceDeterministic }

func (*Deterministic) Explain(_ context.Context, f detection.Finding) (anomaly.Explanation, error) {
	e := anomaly.Explanation{Source: SourceDeterministic}
	day := func(t interface{ Format(string) string }) string { return t.Format("02/01 15:04") }

	switch f.Type {
	case anomaly.TypeReal:
		s := f.Segment
		dir := "por encima"
		if s.Direction == detection.DirectionDown {
			dir = "por debajo"
		}
		e.Reason = fmt.Sprintf("Consumo %.1f%% %s del baseline desde el %s durante %d h, sin un evento operativo que lo explique. Últimas 24 h: %.0f kWh frente a %.0f kWh esperados.",
			math.Abs(s.DeviationPct), dir, day(s.Start), s.Hours, f.Metrics.CurrentKWh, f.Metrics.BaselineKWh)
		if el := s.Electrical; el.Changed() {
			e.Reason += fmt.Sprintf(" La corriente varió %+.0f%%, confirmando consumo real en tus instalaciones (no es error del sensor) con riesgo de sobrecalentamiento y recargos en factura.",
				el.CurrentDeviationPct)
		}
		e.RecommendedAction = "Inspeccionar tableros y cables para verificar calentamiento y ubicar el sobreconsumo."
		e.InvestigationSteps = []string{
			"Revisar tableros y cables principales con cámara térmica para descartar sobrecalentamiento",
			"Verificar si hay maquinaria o equipos pesados encendidos fuera de turno",
			"Revisar el banco de condensadores para corregir la baja eficiencia y evitar penalizaciones",
			"Confirmar con operaciones si hubo trabajos o turnos no registrados",
		}

	case anomaly.TypeExplainable:
		s := f.Segment
		e.Reason = fmt.Sprintf("El consumo cambió %+.1f%% desde el %s, en coincidencia con el evento planificado \"%s\". La red opera estable y segura: es mayor producción, no una falla.",
			s.DeviationPct, day(s.Start), eventDesc(f))
		e.RecommendedAction = "Validar con operaciones el nuevo nivel de consumo y actualizar el baseline."
		e.InvestigationSteps = []string{
			"Confirmar con el responsable de planta que el cambio corresponde al evento reportado",
			"Validar que el nuevo consumo está dentro de lo presupuestado para la operación",
			"Actualizar el consumo de referencia del medidor para incorporar la nueva producción",
		}

	case anomaly.TypeFalsePositive:
		s := f.Segment
		e.Reason = fmt.Sprintf("Caída de %.1f%% durante %d h desde el %s que coincide con el mantenimiento programado \"%s\"; el consumo volvió a la normalidad al finalizar. No representa un riesgo.",
			math.Abs(s.DeviationPct), s.Hours, day(s.Start), eventDesc(f))
		e.RecommendedAction = "No requiere escalamiento. Registrar como mantenimiento planificado."
		e.InvestigationSteps = []string{
			"Vincular la ventana al evento planificado en el historial del medidor",
			"Excluir la ventana del cálculo de baselines futuros",
		}

	case anomaly.TypeDataQuality:
		q := f.Quality
		e.Reason = fmt.Sprintf("Tus máquinas operan con normalidad (%+.1f%%), pero el sensor de medición presentó lecturas congeladas o erráticas durante %d horas desde el %s. Es un problema exclusivo del equipo de medición, no de tu producción.",
			q.ConsumptionDeviationPct, q.AffectedHours, day(q.FirstAt))
		e.RecommendedAction = "Recalibrar y revisar las conexiones del sensor de medición."
		e.InvestigationSteps = []string{
			"Reiniciar el equipo de telemetría y contrastar con la pantalla física del medidor",
			"Revisar conexiones y cableado de los sensores de corriente",
			"Marcar las lecturas afectadas como no confiables para evitar distorsiones en reportes",
			"Programar calibración del sensor si la inconsistencia persiste",
		}
	}
	return e, nil
}

func eventDesc(f detection.Finding) string {
	if f.Event == nil {
		return "sin descripción"
	}
	return f.Event.Description
}
