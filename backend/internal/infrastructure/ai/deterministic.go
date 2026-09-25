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
			e.Reason += fmt.Sprintf(" La corriente varió %+.0f%% y el factor de potencia pasó de %.2f a %.2f, lo que indica un cambio real en la carga eléctrica.",
				el.CurrentDeviationPct, el.PFBaseline, el.PFObserved)
		}
		e.RecommendedAction = "Investigar el medidor y la instalación con prioridad: inspección en sitio."
		e.InvestigationSteps = []string{
			"Verificar en sitio si hay cargas nuevas o equipos operando fuera de lo habitual",
			"Revisar motores y compresores: un FP bajo sugiere carga inductiva anómala o falla",
			"Contrastar la lectura con un analizador de red o medidor patrón",
			"Confirmar con operaciones que no hubo cambios sin reportar",
		}

	case anomaly.TypeExplainable:
		s := f.Segment
		e.Reason = fmt.Sprintf("El consumo cambió %+.1f%% desde el %s, en coincidencia con el evento \"%s\". Voltaje y factor de potencia se mantienen normales: es más carga operativa, no una falla.",
			s.DeviationPct, day(s.Start), eventDesc(f))
		e.RecommendedAction = "Validar con operaciones el nuevo nivel de consumo y actualizar el baseline."
		e.InvestigationSteps = []string{
			"Confirmar con el responsable de planta que el cambio corresponde al evento reportado",
			"Validar que el nuevo consumo está dentro de lo presupuestado para la operación",
			"Recalcular el baseline del medidor a partir de la nueva condición operativa",
		}

	case anomaly.TypeFalsePositive:
		s := f.Segment
		e.Reason = fmt.Sprintf("Caída de %.1f%% durante %d h desde el %s que coincide con el evento planificado \"%s\"; el consumo volvió a su baseline. No representa un riesgo.",
			math.Abs(s.DeviationPct), s.Hours, day(s.Start), eventDesc(f))
		e.RecommendedAction = "No escalar. Registrar como evento planificado."
		e.InvestigationSteps = []string{
			"Vincular la ventana al evento planificado en el historial del medidor",
			"Excluir la ventana del cálculo de baselines futuros",
		}

	case anomaly.TypeDataQuality:
		q := f.Quality
		e.Reason = fmt.Sprintf("El consumo se mantiene estable (%+.1f%%), pero %d horas desde el %s tienen lecturas eléctricas incoherentes: saltos de voltaje/FP y un consumo que no corresponde a V·I·FP. Es un problema de medición, no de carga.",
			q.ConsumptionDeviationPct, q.AffectedHours, day(q.FirstAt))
		e.RecommendedAction = "Validar el medidor y sus comunicaciones antes de usar estos datos."
		e.InvestigationSteps = []string{
			"Revisar conexiones, transformadores de corriente/tensión y comunicación del medidor",
			"Descargar el registro interno del equipo y compararlo con los datos recibidos",
			"Marcar las lecturas afectadas como no confiables para facturación y reportes",
			"Programar calibración o reemplazo si el problema persiste",
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
