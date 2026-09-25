package detection

import (
	"energyhub/internal/domain/event"
	"energyhub/internal/domain/reading"
)

// MeterResult es el resultado completo del análisis de un medidor.
type MeterResult struct {
	MeterID  string
	Profile  Profile
	Segments []Segment
	Quality  *QualityFinding
	Metrics  MeterMetrics
	Findings []Finding
	Readings int
}

// ComputeMetrics calcula consumo actual (24 h), baseline diario, variación y total del periodo.
func ComputeMetrics(p Profile, rs []reading.Reading) MeterMetrics {
	m := MeterMetrics{BaselineKWh: round(p.DailyKWh, 1)}
	for _, r := range rs {
		m.PeriodKWh += r.ConsumptionKWh
	}
	from := len(rs) - 24
	if from < 0 {
		from = 0
	}
	for _, r := range rs[from:] {
		m.CurrentKWh += r.ConsumptionKWh
	}
	m.VariationPct = round(pct(m.CurrentKWh, m.BaselineKWh), 1)
	m.CurrentKWh, m.PeriodKWh = round(m.CurrentKWh, 1), round(m.PeriodKWh, 1)
	return m
}

// AnalyzeMeter ejecuta el pipeline completo para un medidor.
// Los casos de uso pueden invocar cada etapa por separado para reportar progreso.
func AnalyzeMeter(meterID string, readings []reading.Reading, evs []event.Event, cfg Config) (MeterResult, error) {
	rs := sortedCopy(readings)
	p, err := BuildProfile(meterID, rs, cfg)
	if err != nil {
		return MeterResult{}, err
	}
	segs := DetectSegments(p, rs, cfg)
	for i := range segs {
		Correlate(p, rs, &segs[i], cfg)
	}
	q := DetectQuality(p, rs, segs, cfg)
	m := ComputeMetrics(p, rs)
	return MeterResult{
		MeterID: meterID, Profile: p, Segments: segs, Quality: q, Metrics: m,
		Findings: Classify(meterID, p, segs, q, evs, m, cfg), Readings: len(rs),
	}, nil
}
