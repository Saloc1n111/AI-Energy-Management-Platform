package ai

import (
	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
)

// Facts es lo ÚNICO que ve el LLM: un resumen numérico y trazable del hallazgo.
// No se envían lecturas crudas (menos tokens, menos alucinación, menos datos expuestos).
type Facts struct {
	MeterID        string          `json:"meter_id"`
	Classification factsClass      `json:"classification"`
	Window         factsWindow     `json:"window"`
	Signals        []string        `json:"signals"`
	Metrics        factsMetrics    `json:"metrics"`
	Evidence       []factsEvidence `json:"evidence"`
	RelatedEvent   *factsEvent     `json:"related_event"`
	Quality        *factsQuality   `json:"data_quality,omitempty"`
}

type factsClass struct {
	Type            string        `json:"type"`
	Severity        string        `json:"severity"`
	Confidence      float64       `json:"confidence"`
	ConfidenceLabel string        `json:"confidence_label"`
	Factors         []factsFactor `json:"confidence_factors"`
}

type factsFactor struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
	Detail string  `json:"detail"`
}

type factsWindow struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type factsMetrics struct {
	CurrentKWh24h    float64 `json:"current_kwh_24h"`
	BaselineDailyKWh float64 `json:"baseline_daily_kwh"`
	VariationPct     float64 `json:"variation_pct"`
}

type factsEvidence struct {
	Metric       string  `json:"metric"`
	Unit         string  `json:"unit,omitempty"`
	Baseline     float64 `json:"baseline"`
	Observed     float64 `json:"observed"`
	DeviationPct float64 `json:"deviation_pct"`
	Note         string  `json:"note,omitempty"`
}

type factsEvent struct {
	Type        string `json:"type"`
	Timestamp   string `json:"timestamp"`
	Description string `json:"description"`
}

type factsQuality struct {
	AffectedHours int            `json:"affected_hours"`
	IssuesByKind  map[string]int `json:"issues_by_kind"`
}

const layout = "2006-01-02 15:04"

func BuildFacts(f detection.Finding) Facts {
	out := Facts{
		MeterID: f.MeterID,
		Classification: factsClass{
			Type: string(f.Type), Severity: string(f.Severity), Confidence: f.Confidence,
			ConfidenceLabel: anomaly.ConfidenceLabel(f.Confidence),
		},
		Window:  factsWindow{f.WindowStart.Format(layout), f.WindowEnd.Format(layout)},
		Signals: f.Signals,
		Metrics: factsMetrics{f.Metrics.CurrentKWh, f.Metrics.BaselineKWh, f.Metrics.VariationPct},
	}
	for _, c := range f.Factors {
		out.Classification.Factors = append(out.Classification.Factors, factsFactor{c.Name, c.Weight, c.Detail})
	}
	for _, e := range f.Evidence {
		out.Evidence = append(out.Evidence, factsEvidence{e.Metric, e.Unit, e.Baseline, e.Observed, e.DeviationPct, e.Note})
	}
	if f.Event != nil {
		out.RelatedEvent = &factsEvent{string(f.Event.Type), f.Event.Timestamp.Format(layout), f.Event.Description}
	}
	if f.Quality != nil {
		q := &factsQuality{AffectedHours: f.Quality.AffectedHours, IssuesByKind: map[string]int{}}
		for k, v := range f.Quality.ByKind {
			q.IssuesByKind[string(k)] = v
		}
		out.Quality = q
	}
	return out
}
