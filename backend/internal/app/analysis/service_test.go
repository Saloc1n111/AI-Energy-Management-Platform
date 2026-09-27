package analysis_test

import (
	"context"
	"testing"
	"time"

	appanalysis "energyhub/internal/app/analysis"
	domainanalysis "energyhub/internal/domain/analysis"
	domainanomaly "energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	domainevent "energyhub/internal/domain/event"
	domainmeter "energyhub/internal/domain/meter"
	domainreading "energyhub/internal/domain/reading"
)

type mockRunRepo struct {
	latest *domainanalysis.Run
}

func (r *mockRunRepo) Save(ctx context.Context, run *domainanalysis.Run) error {
	r.latest = run
	return nil
}

func (r *mockRunRepo) FindByID(ctx context.Context, id string) (*domainanalysis.Run, error) {
	if r.latest != nil && r.latest.ID == id {
		return r.latest, nil
	}
	return nil, domainanalysis.ErrNotFound
}

func (r *mockRunRepo) FindLatest(ctx context.Context) (*domainanalysis.Run, error) {
	if r.latest != nil {
		return r.latest, nil
	}
	return nil, domainanalysis.ErrNotFound
}

func (r *mockRunRepo) Reset(ctx context.Context) error {
	r.latest = nil
	return nil
}

type mockExplainer struct{}

func (e *mockExplainer) Explain(ctx context.Context, f detection.Finding) (domainanomaly.Explanation, error) {
	return domainanomaly.Explanation{
		Reason:            "Explicación mock",
		RecommendedAction: "Acción mock",
		Source:            "mock",
	}, nil
}

func (e *mockExplainer) Name() string { return "mock" }

type dummyMeterRepo struct{}

func (d *dummyMeterRepo) FindAll(ctx context.Context, f domainmeter.Filter) ([]domainmeter.Meter, error) {
	return []domainmeter.Meter{{MeterID: "M-101", Name: "M1", Status: domainmeter.StatusOK}}, nil
}
func (d *dummyMeterRepo) FindByMeterID(ctx context.Context, id string) (*domainmeter.Meter, error) {
	return &domainmeter.Meter{MeterID: id, Status: domainmeter.StatusOK}, nil
}
func (d *dummyMeterRepo) SaveSnapshots(ctx context.Context, snaps []domainmeter.Snapshot) error {
	return nil
}
func (d *dummyMeterRepo) UpdateStatus(ctx context.Context, meterID string, s domainmeter.Status) error {
	return nil
}

type dummyReadingRepo struct{}

func (d *dummyReadingRepo) FindByMeter(ctx context.Context, meterID string, rg domainreading.Range) ([]domainreading.Reading, error) {
	return nil, nil
}
func (d *dummyReadingRepo) FindAll(ctx context.Context) (map[string][]domainreading.Reading, error) {
	return map[string][]domainreading.Reading{}, nil
}
func (d *dummyReadingRepo) TotalConsumption(ctx context.Context) (float64, error) {
	return 0, nil
}

type dummyEventRepo struct{}

func (d *dummyEventRepo) FindAll(ctx context.Context) ([]domainevent.Event, error) {
	return nil, nil
}
func (d *dummyEventRepo) FindByMeter(ctx context.Context, meterID string) ([]domainevent.Event, error) {
	return nil, nil
}

type dummyAnomalyRepo struct{}

func (d *dummyAnomalyRepo) ReplaceOpen(ctx context.Context, items []domainanomaly.Anomaly) error {
	return nil
}
func (d *dummyAnomalyRepo) FindAll(ctx context.Context, f domainanomaly.Filter) ([]domainanomaly.Anomaly, error) {
	return nil, nil
}
func (d *dummyAnomalyRepo) FindByID(ctx context.Context, id string) (*domainanomaly.Anomaly, error) {
	return nil, domainanomaly.ErrNotFound
}
func (d *dummyAnomalyRepo) UpdateStatus(ctx context.Context, id string, s domainanomaly.Status) error {
	return nil
}

func TestAnalysisService_StartAndConcurrentControl(t *testing.T) {
	runRepo := &mockRunRepo{}
	svc := appanalysis.NewService(appanalysis.Deps{
		Meters:    &dummyMeterRepo{},
		Readings:  &dummyReadingRepo{},
		Events:    &dummyEventRepo{},
		Anomalies: &dummyAnomalyRepo{},
		Runs:      runRepo,
		Explainer: &mockExplainer{},
		NewID:     func() string { return "test_run_001" },
		Clock:     func() time.Time { return time.Now().UTC() },
	})

	ctx := context.Background()

	run, err := svc.Start(ctx)
	if err != nil {
		t.Fatalf("Start error: %v", err)
	}
	if run.ID != "test_run_001" {
		t.Errorf("expected test_run_001, got %s", run.ID)
	}

	// Double start should return ErrAlreadyRunning
	_, err = svc.Start(ctx)
	if err == nil {
		t.Fatal("expected ErrAlreadyRunning on double start, got nil")
	}

	// Verify Latest returns the run
	latest, err := svc.Latest(ctx)
	if err != nil {
		t.Fatalf("Latest error: %v", err)
	}
	if latest.ID != "test_run_001" {
		t.Errorf("expected test_run_001, got %s", latest.ID)
	}
}
