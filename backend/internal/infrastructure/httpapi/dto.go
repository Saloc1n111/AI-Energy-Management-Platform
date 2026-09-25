package httpapi

import (
	"strconv"
	"time"

	appdash "energyhub/internal/app/dashboard"
	appmeters "energyhub/internal/app/meters"
	"energyhub/internal/domain/analysis"
	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	"energyhub/internal/domain/meter"
)

// Los DTO desacoplan el contrato de la API del dominio.

type metricsDTO struct {
	CurrentKWh     float64   `json:"current_kwh"`
	BaselineKWh    float64   `json:"baseline_kwh"`
	VariationPct   float64   `json:"variation_pct"`
	PeriodKWh      float64   `json:"period_kwh"`
	TopSeverity    string    `json:"top_severity"`
	TopAnomalyType string    `json:"top_anomaly_type"`
	AnalyzedAt     time.Time `json:"analyzed_at"`
}

type meterDTO struct {
	MeterID   string      `json:"meter_id"`
	Name      string      `json:"name"`
	Location  string      `json:"location"`
	Status    string      `json:"status"`
	CreatedAt time.Time   `json:"created_at"`
	Metrics   *metricsDTO `json:"metrics"`
}

func toMeterDTO(m meter.Meter) meterDTO {
	d := meterDTO{MeterID: m.MeterID, Name: m.Name, Location: m.Location, Status: string(m.Status), CreatedAt: m.CreatedAt}
	if x := m.Metrics; x != nil {
		d.Metrics = &metricsDTO{x.CurrentKWh, x.BaselineKWh, x.VariationPct, x.PeriodKWh, x.TopSeverity, x.TopAnomalyType, x.AnalyzedAt}
	}
	return d
}

type baselineDTO struct {
	From             time.Time `json:"from"`
	To               time.Time `json:"to"`
	DailyKWh         float64   `json:"daily_kwh"`
	HourlyKWh        []float64 `json:"hourly_kwh"`
	VoltageV         float64   `json:"voltage_v"`
	PowerFactor      float64   `json:"power_factor"`
	ConsumptionRatio float64   `json:"consumption_ratio"`
}

type meterDetailDTO struct {
	meterDTO
	Baseline *baselineDTO `json:"baseline"`
}

func toMeterDetailDTO(d appmeters.Detail) meterDetailDTO {
	out := meterDetailDTO{meterDTO: toMeterDTO(d.Meter)}
	if p := d.Baseline; p != nil {
		out.Baseline = toBaselineDTO(*p)
	}
	return out
}

func toBaselineDTO(p detection.Profile) *baselineDTO {
	b := &baselineDTO{From: p.From, To: p.To, DailyKWh: rnd(p.DailyKWh), VoltageV: rnd(p.Voltage.Median),
		PowerFactor: p.PowerFactor.Median, ConsumptionRatio: p.Ratio.Median, HourlyKWh: make([]float64, 24)}
	for h := 0; h < 24; h++ {
		b.HourlyKWh[h] = rnd(p.Consumption[h].Median)
	}
	return b
}

func rnd(x float64) float64 { return float64(int(x*100+0.5)) / 100 }

type readingDTO struct {
	Timestamp      time.Time `json:"timestamp"`
	ConsumptionKWh float64   `json:"consumption_kwh"`
	ExpectedKWh    float64   `json:"expected_kwh"`
	VoltageV       float64   `json:"voltage_v"`
	CurrentA       float64   `json:"current_a"`
	PowerFactor    float64   `json:"power_factor"`
	Status         string    `json:"status"`
}

func toReadingDTO(p appmeters.Point) readingDTO {
	return readingDTO{p.Timestamp, p.ConsumptionKWh, rnd(p.ExpectedKWh), p.VoltageV, p.CurrentA, p.PowerFactor, p.Status}
}

type evidenceDTO struct {
	Metric       string  `json:"metric"`
	Unit         string  `json:"unit,omitempty"`
	Baseline     float64 `json:"baseline"`
	Observed     float64 `json:"observed"`
	DeviationPct float64 `json:"deviation_pct"`
	Note         string  `json:"note,omitempty"`
}

type factorDTO struct {
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
	Detail string  `json:"detail"`
}

type eventDTO struct {
	Type        string    `json:"type"`
	Timestamp   time.Time `json:"timestamp"`
	Description string    `json:"description"`
}

type anomalyDTO struct {
	ID                 string        `json:"id"`
	RunID              string        `json:"run_id"`
	MeterID            string        `json:"meter_id"`
	DetectedAt         time.Time     `json:"detected_at"`
	WindowStart        time.Time     `json:"window_start"`
	WindowEnd          time.Time     `json:"window_end"`
	Anomaly            bool          `json:"anomaly"`
	Type               string        `json:"type"`
	Severity           string        `json:"severity"`
	Confidence         float64       `json:"confidence"`
	ConfidenceLabel    string        `json:"confidence_label"`
	ConfidenceFactors  []factorDTO   `json:"confidence_factors"`
	PriorityScore      float64       `json:"priority_score"`
	RequiresAttention  bool          `json:"requires_attention"`
	Signals            []string      `json:"signals"`
	Reason             string        `json:"reason"`
	RecommendedAction  string        `json:"recommended_action"`
	InvestigationSteps []string      `json:"investigation_steps"`
	ExplainedBy        string        `json:"explained_by"`
	Evidence           []evidenceDTO `json:"evidence"`
	RelatedEvent       *eventDTO     `json:"related_event"`
	Status             string        `json:"status"`
}

func toAnomalyDTO(a anomaly.Anomaly) anomalyDTO {
	d := anomalyDTO{
		ID: a.ID, RunID: a.RunID, MeterID: a.MeterID, DetectedAt: a.DetectedAt,
		WindowStart: a.WindowStart, WindowEnd: a.WindowEnd,
		Anomaly: a.IsActionable(), Type: string(a.Type), Severity: string(a.Severity),
		Confidence: a.Confidence, ConfidenceLabel: anomaly.ConfidenceLabel(a.Confidence),
		PriorityScore: rnd(a.PriorityScore()), RequiresAttention: a.RequiresAttention(),
		Signals: nonNil(a.Signals), Reason: a.Explanation.Reason, RecommendedAction: a.Explanation.RecommendedAction,
		InvestigationSteps: nonNil(a.Explanation.InvestigationSteps), ExplainedBy: a.Explanation.Source,
		Status: string(a.Status), Evidence: []evidenceDTO{}, ConfidenceFactors: []factorDTO{},
	}
	for _, e := range a.Evidence {
		d.Evidence = append(d.Evidence, evidenceDTO{e.Metric, e.Unit, e.Baseline, e.Observed, e.DeviationPct, e.Note})
	}
	for _, f := range a.ConfidenceFactors {
		d.ConfidenceFactors = append(d.ConfidenceFactors, factorDTO{f.Name, f.Weight, f.Detail})
	}
	if e := a.RelatedEvent; e != nil {
		d.RelatedEvent = &eventDTO{e.Type, e.Timestamp, e.Description}
	}
	return d
}

func nonNil[T any](xs []T) []T {
	if xs == nil {
		return []T{}
	}
	return xs
}

type stepDTO struct {
	Name       string     `json:"name"`
	Label      string     `json:"label"`
	Status     string     `json:"status"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	Detail     string     `json:"detail"`
}

type summaryDTO struct {
	MetersAnalyzed    int            `json:"meters_analyzed"`
	ReadingsAnalyzed  int            `json:"readings_analyzed"`
	AnomaliesDetected int            `json:"anomalies_detected"`
	Actionable        int            `json:"actionable"`
	HighPriority      int            `json:"high_priority"`
	AvgConfidence     float64        `json:"avg_confidence"`
	ByType            map[string]int `json:"by_type"`
	Explainer         string         `json:"explainer"`
	LLMExplained      int            `json:"llm_explained"`
	FallbackExplained int            `json:"fallback_explained"`
}

type runDTO struct {
	ID         string     `json:"id"`
	Status     string     `json:"status"`
	Progress   float64    `json:"progress"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	Steps      []stepDTO  `json:"steps"`
	Summary    summaryDTO `json:"summary"`
	Message    string     `json:"message,omitempty"`
	Error      string     `json:"error,omitempty"`
}

func toRunDTO(r analysis.Run) runDTO {
	s := r.Summary
	d := runDTO{
		ID: r.ID, Status: string(r.Status), Progress: rnd(r.Progress()), StartedAt: r.StartedAt, FinishedAt: r.FinishedAt,
		Summary: summaryDTO{s.MetersAnalyzed, s.ReadingsAnalyzed, s.AnomaliesDetected, s.Actionable, s.HighPriority,
			s.AvgConfidence, s.ByType, s.Explainer, s.LLMExplained, s.FallbackExplained},
		Error: r.Error, Steps: []stepDTO{},
	}
	if d.Summary.ByType == nil {
		d.Summary.ByType = map[string]int{}
	}
	for _, st := range r.Steps {
		d.Steps = append(d.Steps, stepDTO{string(st.Name), st.Label, string(st.Status), st.StartedAt, st.FinishedAt, st.Detail})
	}
	if r.Status == analysis.StatusCompleted {
		d.Message = formatMessage(s.AnomaliesDetected, s.HighPriority)
	}
	return d
}

func formatMessage(total, high int) string {
	return strconv.Itoa(total) + " anomalías detectadas · " + strconv.Itoa(high) + " requieren atención prioritaria"
}

type dashboardDTO struct {
	TotalMeters         int            `json:"total_meters"`
	MetersByStatus      map[string]int `json:"meters_by_status"`
	TotalConsumptionKWh float64        `json:"total_consumption_kwh"`
	AnomaliesDetected   int            `json:"anomalies_detected"`
	Actionable          int            `json:"actionable"`
	HighPriority        int            `json:"high_priority"`
	AvgConfidence       float64        `json:"avg_confidence"`
	ByType              map[string]int `json:"by_type"`
	TopPriority         []anomalyDTO   `json:"top_priority"`
	LastAnalysis        *runDTO        `json:"last_analysis"`
}

func toDashboardDTO(s appdash.Summary) dashboardDTO {
	d := dashboardDTO{
		TotalMeters: s.TotalMeters, MetersByStatus: s.MetersByStatus, TotalConsumptionKWh: rnd(s.TotalConsumptionKWh),
		AnomaliesDetected: s.AnomaliesDetected, Actionable: s.Actionable, HighPriority: s.HighPriority,
		AvgConfidence: s.AvgConfidence, ByType: s.ByType, TopPriority: []anomalyDTO{},
	}
	for _, a := range s.TopPriority {
		d.TopPriority = append(d.TopPriority, toAnomalyDTO(a))
	}
	if s.LastAnalysis != nil {
		r := toRunDTO(*s.LastAnalysis)
		d.LastAnalysis = &r
	}
	return d
}
