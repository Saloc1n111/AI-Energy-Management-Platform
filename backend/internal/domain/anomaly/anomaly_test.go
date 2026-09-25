package anomaly_test

import (
	"errors"
	"testing"

	"energyhub/internal/domain/anomaly"
)

func TestNew_Validation(t *testing.T) {
	base := anomaly.Params{MeterID: "M-109", Type: anomaly.TypeReal, Severity: anomaly.SeverityHigh, Confidence: 0.9}
	cases := map[string]struct {
		mut  func(p *anomaly.Params)
		want error
	}{
		"missing meter":  {func(p *anomaly.Params) { p.MeterID = "" }, anomaly.ErrMissingMeter},
		"bad type":       {func(p *anomaly.Params) { p.Type = "X" }, anomaly.ErrInvalidType},
		"bad severity":   {func(p *anomaly.Params) { p.Severity = "X" }, anomaly.ErrInvalidSeverity},
		"confidence > 1": {func(p *anomaly.Params) { p.Confidence = 1.5 }, anomaly.ErrInvalidConfidence},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			p := base
			c.mut(&p)
			if _, err := anomaly.New(p); !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
	a, err := anomaly.New(base)
	if err != nil || a.Status != anomaly.StatusOpen {
		t.Fatalf("valid params: %v %+v", err, a)
	}
}

func TestPriority_FalsePositiveNeverOutranksActionable(t *testing.T) {
	fp := anomaly.Anomaly{Type: anomaly.TypeFalsePositive, Severity: anomaly.SeverityHigh, Confidence: 0.99}
	low := anomaly.Anomaly{Type: anomaly.TypeReal, Severity: anomaly.SeverityLow, Confidence: 0.1}
	if fp.PriorityScore() >= low.PriorityScore() || fp.RequiresAttention() {
		t.Fatal("a false positive must never escalate")
	}
}

func TestTransitions(t *testing.T) {
	a := anomaly.Anomaly{Status: anomaly.StatusOpen}
	if err := a.TransitionTo(anomaly.StatusAcknowledged); err != nil {
		t.Fatal(err)
	}
	if err := a.TransitionTo(anomaly.StatusResolved); err != nil {
		t.Fatal(err)
	}
	if err := a.TransitionTo(anomaly.StatusAcknowledged); !errors.Is(err, anomaly.ErrInvalidTransition) {
		t.Fatalf("RESOLVED → ACKNOWLEDGED should fail, got %v", err)
	}
}

// Regresión: M-112 (DATA_QUALITY/HIGH, conf 0.95) no debe superar a M-109 (REAL/HIGH, conf 0.93).
func TestPriority_RealOutranksDataQualityAtSameSeverity(t *testing.T) {
	real := anomaly.Anomaly{Type: anomaly.TypeReal, Severity: anomaly.SeverityHigh, Confidence: 0.93}
	dq := anomaly.Anomaly{Type: anomaly.TypeDataQuality, Severity: anomaly.SeverityHigh, Confidence: 0.95}
	medium := anomaly.Anomaly{Type: anomaly.TypeReal, Severity: anomaly.SeverityMedium, Confidence: 0.99}
	if real.PriorityScore() <= dq.PriorityScore() {
		t.Fatal("real anomaly must outrank data quality at equal severity")
	}
	if dq.PriorityScore() <= medium.PriorityScore() {
		t.Fatal("severity must dominate type")
	}
}
