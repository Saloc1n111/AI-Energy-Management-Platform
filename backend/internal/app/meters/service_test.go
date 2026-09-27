package meters_test

import (
	"context"
	"testing"
	"time"

	"energyhub/internal/app/meters"
	"energyhub/internal/domain/detection"
	domainmeter "energyhub/internal/domain/meter"
	domainreading "energyhub/internal/domain/reading"
)

type mockMeterRepo struct {
	meter *domainmeter.Meter
}

func (m *mockMeterRepo) FindAll(ctx context.Context, f domainmeter.Filter) ([]domainmeter.Meter, error) {
	if m.meter != nil {
		return []domainmeter.Meter{*m.meter}, nil
	}
	return nil, nil
}

func (m *mockMeterRepo) FindByMeterID(ctx context.Context, id string) (*domainmeter.Meter, error) {
	if m.meter != nil && m.meter.MeterID == id {
		return m.meter, nil
	}
	return nil, domainmeter.ErrNotFound
}

func (m *mockMeterRepo) SaveSnapshots(ctx context.Context, snaps []domainmeter.Snapshot) error {
	return nil
}

func (m *mockMeterRepo) UpdateStatus(ctx context.Context, meterID string, s domainmeter.Status) error {
	if m.meter != nil && m.meter.MeterID == meterID {
		m.meter.Status = s
		return nil
	}
	return domainmeter.ErrNotFound
}

type mockReadingRepo struct {
	readings []domainreading.Reading
}

func (r *mockReadingRepo) FindByMeter(ctx context.Context, meterID string, rg domainreading.Range) ([]domainreading.Reading, error) {
	return r.readings, nil
}

func (r *mockReadingRepo) FindAll(ctx context.Context) (map[string][]domainreading.Reading, error) {
	return map[string][]domainreading.Reading{"M-101": r.readings}, nil
}

func (r *mockReadingRepo) TotalConsumption(ctx context.Context) (float64, error) {
	return 100.0, nil
}

func TestMetersService_ListAndGet(t *testing.T) {
	mockM := &domainmeter.Meter{
		MeterID:   "M-101",
		Name:      "Línea 1",
		Status:    domainmeter.StatusOK,
		CreatedAt: time.Now(),
	}
	meterRepo := &mockMeterRepo{meter: mockM}
	readingRepo := &mockReadingRepo{}
	cfg := detection.DefaultConfig()

	svc := meters.NewService(meterRepo, readingRepo, cfg)
	ctx := context.Background()

	list, err := svc.List(ctx, domainmeter.Filter{})
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 meter, got %d", len(list))
	}

	detail, err := svc.Get(ctx, "M-101")
	if err != nil {
		t.Fatalf("Get error: %v", err)
	}
	if detail.Meter.MeterID != "M-101" {
		t.Errorf("expected M-101, got %s", detail.Meter.MeterID)
	}

	// Meter not found
	_, err = svc.Get(ctx, "NON_EXISTENT")
	if err == nil {
		t.Fatal("expected error for non-existent meter, got nil")
	}
}
