package anomalies_test

import (
	"context"
	"testing"
	"time"

	"energyhub/internal/app/anomalies"
	domainanomaly "energyhub/internal/domain/anomaly"
	domainmeter "energyhub/internal/domain/meter"
)

type mockAnomalyRepo struct {
	items []domainanomaly.Anomaly
}

func (m *mockAnomalyRepo) ReplaceOpen(ctx context.Context, items []domainanomaly.Anomaly) error {
	m.items = items
	return nil
}

func (m *mockAnomalyRepo) FindAll(ctx context.Context, f domainanomaly.Filter) ([]domainanomaly.Anomaly, error) {
	return m.items, nil
}

func (m *mockAnomalyRepo) FindByID(ctx context.Context, id string) (*domainanomaly.Anomaly, error) {
	for i := range m.items {
		if m.items[i].ID == id {
			return &m.items[i], nil
		}
	}
	return nil, domainanomaly.ErrNotFound
}

func (m *mockAnomalyRepo) UpdateStatus(ctx context.Context, id string, s domainanomaly.Status) error {
	for i := range m.items {
		if m.items[i].ID == id {
			m.items[i].Status = s
			return nil
		}
	}
	return domainanomaly.ErrNotFound
}

type mockMeterRepo struct {
	status domainmeter.Status
}

func (m *mockMeterRepo) FindAll(ctx context.Context, f domainmeter.Filter) ([]domainmeter.Meter, error) {
	return nil, nil
}

func (m *mockMeterRepo) FindByMeterID(ctx context.Context, id string) (*domainmeter.Meter, error) {
	return &domainmeter.Meter{MeterID: id, Status: m.status}, nil
}

func (m *mockMeterRepo) SaveSnapshots(ctx context.Context, snaps []domainmeter.Snapshot) error {
	return nil
}

func (m *mockMeterRepo) UpdateStatus(ctx context.Context, meterID string, s domainmeter.Status) error {
	m.status = s
	return nil
}

func TestAnomaliesService_ListAndChangeStatus(t *testing.T) {
	now := time.Now().UTC()
	anm1, err := domainanomaly.New(domainanomaly.Params{
		ID:          "anm_1",
		MeterID:     "M-101",
		RunID:       "run_1",
		Type:        domainanomaly.TypeReal,
		Severity:    domainanomaly.SeverityHigh,
		Confidence:  0.9,
		DetectedAt:  now,
		WindowStart: now.Add(-1 * time.Hour),
		WindowEnd:   now,
	})
	if err != nil {
		t.Fatalf("failed to create anm1: %v", err)
	}

	anm2, err := domainanomaly.New(domainanomaly.Params{
		ID:          "anm_2",
		MeterID:     "M-101",
		RunID:       "run_1",
		Type:        domainanomaly.TypeDataQuality,
		Severity:    domainanomaly.SeverityMedium,
		Confidence:  0.7,
		DetectedAt:  now,
		WindowStart: now.Add(-1 * time.Hour),
		WindowEnd:   now,
	})
	if err != nil {
		t.Fatalf("failed to create anm2: %v", err)
	}

	anomalyRepo := &mockAnomalyRepo{items: []domainanomaly.Anomaly{*anm2, *anm1}}
	meterRepo := &mockMeterRepo{status: domainmeter.StatusAlert}

	svc := anomalies.NewService(anomalyRepo, meterRepo)
	ctx := context.Background()

	list, err := svc.List(ctx, domainanomaly.Filter{})
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 items, got %d", len(list))
	}
	// High severity should be sorted first by PriorityScore
	if list[0].ID != "anm_1" {
		t.Errorf("expected anm_1 first by priority, got %s", list[0].ID)
	}

	// Change status
	updated, err := svc.ChangeStatus(ctx, "anm_1", domainanomaly.StatusAcknowledged)
	if err != nil {
		t.Fatalf("ChangeStatus error: %v", err)
	}
	if updated.Status != domainanomaly.StatusAcknowledged {
		t.Errorf("expected ACKNOWLEDGED, got %s", updated.Status)
	}
}
