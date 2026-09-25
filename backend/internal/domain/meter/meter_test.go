package meter_test

import (
	"testing"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/meter"
)

func TestDeriveStatus(t *testing.T) {
	a := func(tp anomaly.Type, s anomaly.Severity) anomaly.Anomaly {
		return anomaly.Anomaly{Type: tp, Severity: s, Status: anomaly.StatusOpen}
	}
	cases := []struct {
		name  string
		items []anomaly.Anomaly
		want  meter.Status
	}{
		{"none", nil, meter.StatusOK},
		{"false positive only", []anomaly.Anomaly{a(anomaly.TypeFalsePositive, anomaly.SeverityLow)}, meter.StatusOK},
		{"explainable", []anomaly.Anomaly{a(anomaly.TypeExplainable, anomaly.SeverityMedium)}, meter.StatusAlert},
		{"data quality high", []anomaly.Anomaly{a(anomaly.TypeDataQuality, anomaly.SeverityHigh)}, meter.StatusAlert},
		{"real high", []anomaly.Anomaly{a(anomaly.TypeReal, anomaly.SeverityHigh)}, meter.StatusCritical},
	}
	for _, c := range cases {
		if got := meter.DeriveStatus(c.items); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}
}
