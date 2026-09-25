package detection_test

import (
	"encoding/csv"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	"energyhub/internal/domain/event"
	"energyhub/internal/domain/reading"
)

// El test usa los CSV reales de la prueba (backend/data). No usa expected_results.csv.
const dataDir = "../../../data"

func loadCSV(t *testing.T, name string) [][]string {
	t.Helper()
	f, err := os.Open(filepath.Join(dataDir, name))
	if err != nil {
		t.Skipf("dataset no disponible: %v", err)
	}
	defer f.Close()
	recs, err := csv.NewReader(f).ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	return recs[1:]
}

func parseTS(t *testing.T, v string) time.Time {
	for _, l := range []string{"2006-01-02 15:04:05", "2006-01-02 15:04"} {
		if ts, err := time.Parse(l, v); err == nil {
			return ts
		}
	}
	t.Fatalf("bad ts %q", v)
	return time.Time{}
}

func loadDataset(t *testing.T) (map[string][]reading.Reading, map[string][]event.Event) {
	t.Helper()
	rs := map[string][]reading.Reading{}
	for _, r := range loadCSV(t, "readings.csv") {
		f := func(i int) float64 { v, _ := strconv.ParseFloat(r[i], 64); return v }
		rs[r[0]] = append(rs[r[0]], reading.Reading{
			MeterID: r[0], Timestamp: parseTS(t, r[1]), ConsumptionKWh: f(2),
			VoltageV: f(3), CurrentA: f(4), PowerFactor: f(5), Status: r[6],
		})
	}
	evs := map[string][]event.Event{}
	for _, r := range loadCSV(t, "events.csv") {
		evs[r[0]] = append(evs[r[0]], event.Event{MeterID: r[0], Timestamp: parseTS(t, r[1]), Type: event.Type(r[2]), Description: r[3]})
	}
	return rs, evs
}

func analyzeAll(t *testing.T) map[string]detection.MeterResult {
	rs, evs := loadDataset(t)
	out := map[string]detection.MeterResult{}
	for id, readings := range rs {
		res, err := detection.AnalyzeMeter(id, readings, evs[id], detection.DefaultConfig())
		if err != nil {
			t.Fatalf("%s: %v", id, err)
		}
		out[id] = res
	}
	return out
}

func TestEngine_DatasetCases(t *testing.T) {
	results := analyzeAll(t)
	cases := []struct {
		meter    string
		typ      anomaly.Type
		severity anomaly.Severity
		minConf  float64
	}{
		{"M-109", anomaly.TypeReal, anomaly.SeverityHigh, 0.85},
		{"M-112", anomaly.TypeDataQuality, anomaly.SeverityHigh, 0.8},
		{"M-104", anomaly.TypeExplainable, anomaly.SeverityMedium, 0.8},
		{"M-106", anomaly.TypeFalsePositive, anomaly.SeverityLow, 0.7},
	}
	for _, c := range cases {
		t.Run(c.meter, func(t *testing.T) {
			fs := results[c.meter].Findings
			if len(fs) != 1 {
				t.Fatalf("expected 1 finding, got %d: %+v", len(fs), fs)
			}
			f := fs[0]
			if f.Type != c.typ || f.Severity != c.severity {
				t.Fatalf("got %s/%s, want %s/%s", f.Type, f.Severity, c.typ, c.severity)
			}
			if f.Confidence < c.minConf {
				t.Fatalf("confidence %.2f < %.2f", f.Confidence, c.minConf)
			}
			if len(f.Evidence) == 0 {
				t.Fatal("finding without evidence")
			}
		})
	}
}

func TestEngine_NoFindingsOnHealthyMeters(t *testing.T) {
	for id, res := range analyzeAll(t) {
		switch id {
		case "M-104", "M-106", "M-109", "M-112":
			continue
		}
		if len(res.Findings) > 0 {
			t.Errorf("%s: unexpected findings %+v", id, res.Findings)
		}
	}
}

func TestEngine_M109BaselineAndVariation(t *testing.T) {
	m := analyzeAll(t)["M-109"].Metrics
	if m.BaselineKWh < 1000 || m.BaselineKWh > 1100 {
		t.Errorf("baseline %.1f fuera de rango esperado (~1050)", m.BaselineKWh)
	}
	if m.VariationPct < 90 {
		t.Errorf("variation %.1f%% should be > 90%%", m.VariationPct)
	}
}

// Robustez: la detección de M-109 y M-112 sale de los datos, no del CSV de eventos.
func TestEngine_ConclusionsDoNotDependOnEvents(t *testing.T) {
	rs, _ := loadDataset(t)
	cfg := detection.DefaultConfig()
	for meter, want := range map[string]anomaly.Type{
		"M-109": anomaly.TypeReal,
		"M-112": anomaly.TypeDataQuality,
		"M-104": anomaly.TypeReal, // sin el evento operativo, un +47% sostenido SÍ es una anomalía real
	} {
		res, err := detection.AnalyzeMeter(meter, rs[meter], nil, cfg)
		if err != nil {
			t.Fatal(err)
		}
		if len(res.Findings) != 1 || res.Findings[0].Type != want {
			t.Errorf("%s sin eventos: got %+v, want %s", meter, res.Findings, want)
		}
	}
}

// Un evento UNKNOWN nunca debe convertir una anomalía en "explicable".
func TestEngine_UnknownEventDoesNotExplain(t *testing.T) {
	rs, evs := loadDataset(t)
	res, _ := detection.AnalyzeMeter("M-109", rs["M-109"], evs["M-109"], detection.DefaultConfig())
	f := res.Findings[0]
	if f.Type != anomaly.TypeReal || f.Event == nil || f.Event.Type != event.TypeUnknown {
		t.Fatalf("expected REAL anomaly linked to UNKNOWN event, got %s / %+v", f.Type, f.Event)
	}
}
