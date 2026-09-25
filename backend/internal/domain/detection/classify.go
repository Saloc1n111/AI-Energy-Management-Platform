package detection

import (
	"fmt"
	"math"
	"sort"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/event"
)

// Señales legibles que acompañan a cada hallazgo (útiles para UI y para el LLM).
const (
	SignalConsumptionSpike     = "CONSUMPTION_SPIKE"
	SignalPersistentShift      = "PERSISTENT_SHIFT"
	SignalConsumptionDrop      = "CONSUMPTION_DROP"
	SignalPowerFactorDrop      = "POWER_FACTOR_DROP"
	SignalVoltageShift         = "VOLTAGE_SHIFT"
	SignalElectricalMismatch   = "ELECTRICAL_INCONSISTENCY"
	SignalEventMatch           = "OPERATIONAL_EVENT_MATCH"
	SignalNoExplainingEvent    = "NO_EXPLAINING_EVENT"
	SignalEventUnknown         = "EVENT_REPORTED_UNKNOWN"
	SignalDurationMatchesEvent = "DURATION_MATCHES_EVENT"
	SignalRecovered            = "RECOVERED_TO_BASELINE"
	SignalStableConsumption    = "STABLE_CONSUMPTION"
	SignalDataQualityEvent     = "DATA_QUALITY_EVENT"
)

// MeterMetrics es la foto de consumo que se muestra en la lista y el detalle de medidores.
type MeterMetrics struct {
	CurrentKWh   float64 // últimas 24 h
	BaselineKWh  float64 // consumo diario esperado (suma de medianas horarias)
	VariationPct float64
	PeriodKWh    float64
}

// Finding es un hallazgo clasificado, listo para ser explicado y persistido como Anomaly.
type Finding struct {
	MeterID     string
	Type        anomaly.Type
	Severity    anomaly.Severity
	Confidence  float64
	Factors     []anomaly.ConfidenceFactor
	Signals     []string
	WindowStart time.Time
	WindowEnd   time.Time
	Segment     *Segment
	Quality     *QualityFinding
	Event       *event.Event
	Evidence    []anomaly.Evidence
	Metrics     MeterMetrics
}

func (f Finding) EventRef() *anomaly.EventRef {
	if f.Event == nil {
		return nil
	}
	return &anomaly.EventRef{Type: string(f.Event.Type), Timestamp: f.Event.Timestamp, Description: f.Event.Description}
}

type confidence struct {
	base    float64
	factors []anomaly.ConfidenceFactor
}

func newConfidence(base float64) *confidence {
	return &confidence{base: base, factors: []anomaly.ConfidenceFactor{{Name: "base", Weight: base, Detail: "Punto de partida del modelo para este tipo de hallazgo"}}}
}

func (c *confidence) add(name string, w float64, detail string) {
	c.factors = append(c.factors, anomaly.ConfidenceFactor{Name: name, Weight: w, Detail: detail})
}

func (c *confidence) value() float64 {
	sum := 0.0
	for _, f := range c.factors {
		sum += f.Weight
	}
	return round(math.Min(0.99, math.Max(0.05, sum)), 2)
}

func nearestEvent(evs []event.Event, at time.Time, tolHours int) (*event.Event, float64) {
	var best *event.Event
	bestDist := math.Inf(1)
	for i := range evs {
		d := math.Abs(evs[i].Timestamp.Sub(at).Hours())
		if d <= float64(tolHours) && d < bestDist {
			best, bestDist = &evs[i], d
		}
	}
	return best, bestDist
}

func alignmentWeight(distHours float64) float64 {
	if distHours <= 1 {
		return 0.25
	}
	return 0.15
}

// Classify convierte segmentos y problemas de calidad en hallazgos tipificados.
func Classify(meterID string, p Profile, segs []Segment, q *QualityFinding, evs []event.Event, m MeterMetrics, cfg Config) []Finding {
	var out []Finding
	for i := range segs {
		out = append(out, classifySegment(meterID, p, segs[i], evs, m, cfg))
	}
	if q != nil {
		out = append(out, classifyQuality(meterID, p, *q, evs, m, cfg))
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].WindowStart.Before(out[j].WindowStart) })
	return out
}

func classifySegment(meterID string, p Profile, seg Segment, evs []event.Event, m MeterMetrics, cfg Config) Finding {
	f := Finding{MeterID: meterID, WindowStart: seg.Start, WindowEnd: seg.End, Segment: &seg, Metrics: m}
	ev, dist := nearestEvent(evs, seg.Start, cfg.EventToleranceHours)
	f.Event = ev
	explains := ev != nil && ((seg.Direction == DirectionUp && ev.ExplainsIncrease()) ||
		(seg.Direction == DirectionDown && ev.ExplainsDecrease()))
	elec := seg.Electrical
	absDev := math.Abs(seg.DeviationPct)

	switch {
	case seg.Direction == DirectionDown:
		f.Signals = append(f.Signals, SignalConsumptionDrop)
	case seg.Persistent:
		f.Signals = append(f.Signals, SignalPersistentShift)
	default:
		f.Signals = append(f.Signals, SignalConsumptionSpike)
	}
	if elec.PowerFactorDrop {
		f.Signals = append(f.Signals, SignalPowerFactorDrop)
	}
	if elec.VoltageShift {
		f.Signals = append(f.Signals, SignalVoltageShift)
	}
	if elec.RatioShift {
		f.Signals = append(f.Signals, SignalElectricalMismatch)
	}

	c := newConfidence(0.5)
	switch {
	case explains && seg.Direction == DirectionDown && seg.Recovered:
		// Caída explicada por un evento planificado y ya recuperada → no escalar.
		f.Type, f.Severity = anomaly.TypeFalsePositive, anomaly.SeverityLow
		f.Signals = append(f.Signals, SignalEventMatch, SignalRecovered)
		c.add("event_alignment", alignmentWeight(dist), fmt.Sprintf("Evento %s a %.0f h del inicio de la ventana", ev.Type, dist))
		if h, ok := ev.DeclaredDurationHours(); ok && math.Abs(float64(h-seg.Hours)) <= 2 {
			f.Signals = append(f.Signals, SignalDurationMatchesEvent)
			c.add("duration_match", 0.1, fmt.Sprintf("Duración observada %d h vs declarada %d h", seg.Hours, h))
		}
		c.add("recovered", 0.1, "El consumo volvió al baseline tras la ventana")

	case explains:
		f.Type, f.Severity = anomaly.TypeExplainable, anomaly.SeverityMedium
		f.Signals = append(f.Signals, SignalEventMatch)
		c.add("event_alignment", alignmentWeight(dist), fmt.Sprintf("Evento %s a %.0f h del inicio del cambio", ev.Type, dist))
		c.add("direction_consistent", 0.05, "La dirección del cambio es coherente con el tipo de evento")
		if !elec.Changed() {
			c.add("electrical_consistent", 0.1, "Voltaje, FP y ratio eléctrico se mantienen normales: más carga, no falla")
		}
		if seg.Persistent {
			c.add("persistent", 0.05, "Cambio sostenido, compatible con un cambio operativo permanente")
		}

	default:
		f.Type = anomaly.TypeReal
		f.Signals = append(f.Signals, SignalNoExplainingEvent)
		switch {
		case absDev >= cfg.HighDeviationPct || elec.Changed():
			f.Severity = anomaly.SeverityHigh
		case seg.Persistent:
			f.Severity = anomaly.SeverityMedium
		default:
			f.Severity = anomaly.SeverityLow
		}
		if absDev >= cfg.HighDeviationPct {
			c.add("magnitude", 0.15, fmt.Sprintf("Desviación de %.1f%% (umbral alto %.0f%%)", seg.DeviationPct, cfg.HighDeviationPct))
		} else {
			c.add("magnitude", 0.08, fmt.Sprintf("Desviación de %.1f%%", seg.DeviationPct))
		}
		if seg.Persistent {
			c.add("persistent", 0.1, fmt.Sprintf("Cambio sostenido durante %d h", seg.Hours))
		}
		if elec.Changed() {
			c.add("electrical_corroboration", 0.1, "Las variables eléctricas cambiaron junto con el consumo")
		}
		if seg.MaxAbsZ >= 6 {
			c.add("statistical_strength", 0.05, fmt.Sprintf("z robusto máximo %.1f", seg.MaxAbsZ))
		}
		if ev != nil && ev.Type == event.TypeUnknown {
			f.Signals = append(f.Signals, SignalEventUnknown)
			c.add("no_operational_cause", 0.03, "El único registro es UNKNOWN: se confirma que no hay causa operativa reportada")
		}
	}

	f.Confidence, f.Factors = c.value(), c.factors
	f.Evidence = segmentEvidence(p, seg, ev, m)
	return f
}

func classifyQuality(meterID string, p Profile, q QualityFinding, evs []event.Event, m MeterMetrics, cfg Config) Finding {
	f := Finding{MeterID: meterID, Type: anomaly.TypeDataQuality, WindowStart: q.FirstAt, WindowEnd: q.LastAt, Quality: &q, Metrics: m}
	c := newConfidence(0.5)

	for _, k := range []IssueKind{IssueVoltageOutlier, IssuePowerFactorOutlier, IssueElectricalInconsistency, IssueMissingReading, IssueDuplicateTimestamp, IssueInvalidValue} {
		if q.ByKind[k] > 0 {
			f.Signals = append(f.Signals, string(k))
		}
	}
	if math.Abs(q.ConsumptionDeviationPct) < cfg.StableConsumptionPct {
		f.Signals = append(f.Signals, SignalStableConsumption)
		c.add("stable_consumption", 0.15, fmt.Sprintf("El consumo se mantiene estable (%.1f%%) mientras las lecturas eléctricas saltan", q.ConsumptionDeviationPct))
	}
	if q.AffectedHours >= cfg.HighQualityHits {
		c.add("recurrence", 0.1, fmt.Sprintf("%d horas afectadas", q.AffectedHours))
	}
	if len(q.ByKind) >= 2 {
		c.add("multiple_symptoms", 0.1, fmt.Sprintf("%d tipos de inconsistencia distintos", len(q.ByKind)))
	}

	ev, _ := nearestEvent(evs, q.FirstAt, cfg.EventToleranceHours)
	if ev != nil && ev.CorroboratesDataQuality() {
		f.Event = ev
		f.Signals = append(f.Signals, SignalDataQualityEvent)
		c.add("event_corroboration", 0.1, "Existe un evento DATA_QUALITY reportado para el medidor")
	}

	f.Severity = anomaly.SeverityMedium
	if q.AffectedHours >= cfg.HighQualityHits || f.Event != nil {
		f.Severity = anomaly.SeverityHigh
	}
	f.Confidence, f.Factors = c.value(), c.factors
	f.Evidence = qualityEvidence(p, q, ev, m)
	return f
}

func segmentEvidence(p Profile, s Segment, ev *event.Event, m MeterMetrics) []anomaly.Evidence {
	e := s.Electrical
	out := []anomaly.Evidence{
		{Metric: "consumption_window", Unit: "kWh", Baseline: s.ExpectedKWh, Observed: s.ObservedKWh, DeviationPct: s.DeviationPct,
			Note: fmt.Sprintf("Ventana %s → %s (%d h)", s.Start.Format("2006-01-02 15:04"), s.End.Format("2006-01-02 15:04"), s.Hours)},
		{Metric: "consumption_daily", Unit: "kWh", Baseline: round(m.BaselineKWh, 1), Observed: round(m.CurrentKWh, 1), DeviationPct: round(m.VariationPct, 1),
			Note: "Últimas 24 h vs consumo diario esperado"},
		{Metric: "current_a", Unit: "A", Baseline: e.CurrentExpectedA, Observed: e.CurrentObservedA, DeviationPct: e.CurrentDeviationPct,
			Note: "Corriente media en la ventana"},
		{Metric: "power_factor", Unit: "", Baseline: e.PFBaseline, Observed: e.PFObserved, DeviationPct: round(pct(e.PFObserved, e.PFBaseline), 1),
			Note: fmt.Sprintf("z robusto %.1f", e.PFZ)},
		{Metric: "voltage_v", Unit: "V", Baseline: e.VoltageBaseline, Observed: e.VoltageObserved, DeviationPct: round(pct(e.VoltageObserved, e.VoltageBaseline), 1),
			Note: fmt.Sprintf("z robusto %.1f", e.VoltageZ)},
		{Metric: "consumption_vs_vipf", Unit: "ratio", Baseline: e.RatioBaseline, Observed: e.RatioObserved, DeviationPct: round(pct(e.RatioObserved, e.RatioBaseline), 1),
			Note: "Coherencia consumo / (V·I·FP)"},
	}
	if ev != nil {
		out = append(out, eventEvidence(*ev, s.Start))
	} else {
		out = append(out, anomaly.Evidence{Metric: "event", Note: "Sin eventos registrados cerca de la ventana"})
	}
	return out
}

func qualityEvidence(p Profile, q QualityFinding, ev *event.Event, m MeterMetrics) []anomaly.Evidence {
	out := []anomaly.Evidence{
		{Metric: "consumption_window", Unit: "kWh", Baseline: q.ExpectedKWh, Observed: q.ObservedKWh, DeviationPct: q.ConsumptionDeviationPct,
			Note: fmt.Sprintf("Consumo en la ventana afectada (%d h con inconsistencias)", q.AffectedHours)},
		{Metric: "consumption_daily", Unit: "kWh", Baseline: round(m.BaselineKWh, 1), Observed: round(m.CurrentKWh, 1), DeviationPct: round(m.VariationPct, 1),
			Note: "Últimas 24 h vs consumo diario esperado"},
	}
	// Los 4 síntomas más extremos como evidencia puntual.
	worst := append([]QualityIssue(nil), q.Issues...)
	sort.Slice(worst, func(i, j int) bool { return math.Abs(worst[i].Z) > math.Abs(worst[j].Z) })
	if len(worst) > 4 {
		worst = worst[:4]
	}
	for _, is := range worst {
		out = append(out, anomaly.Evidence{
			Metric: is.Metric, Baseline: round(is.Expected, 3), Observed: is.Value,
			DeviationPct: round(pct(is.Value, is.Expected), 1),
			Note:         fmt.Sprintf("%s · %s · z=%.1f", is.Timestamp.Format("2006-01-02 15:04"), is.Kind, is.Z),
		})
	}
	if ev != nil {
		out = append(out, eventEvidence(*ev, q.FirstAt))
	}
	return out
}

func eventEvidence(ev event.Event, ref time.Time) anomaly.Evidence {
	return anomaly.Evidence{
		Metric: "event",
		Note: fmt.Sprintf("%s · %s · \"%s\" (a %.0f h del inicio)", ev.Type, ev.Timestamp.Format("2006-01-02 15:04"),
			ev.Description, math.Abs(ev.Timestamp.Sub(ref).Hours())),
	}
}
