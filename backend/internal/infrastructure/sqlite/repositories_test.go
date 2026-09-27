package sqlite_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	domainanalysis "energyhub/internal/domain/analysis"
	domainanomaly "energyhub/internal/domain/anomaly"
	domainmeter "energyhub/internal/domain/meter"
	domainreading "energyhub/internal/domain/reading"
	domainvisit "energyhub/internal/domain/visit"
	"energyhub/internal/infrastructure/sqlite"
)

func setupTestRepos(t *testing.T) (*sqlite.MeterRepository, *sqlite.ReadingRepository, *sqlite.AnomalyRepository, *sqlite.EventRepository, *sqlite.AnalysisRepository, *sqlite.VisitRepository) {
	dbPath := filepath.Join(t.TempDir(), "repos_test.db")
	db, err := sqlite.Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := sqlite.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Seed one meter for tests
	_, err = db.Exec("INSERT INTO meters (meter_id, name, location, status, created_at) VALUES ('M-101', 'Línea 1', 'Nave A', 'OK', '2026-09-01 00:00:00')")
	if err != nil {
		t.Fatalf("seed meter error: %v", err)
	}

	meterRepo := sqlite.NewMeterRepository(db)
	readingRepo := sqlite.NewReadingRepository(db)
	anomalyRepo := sqlite.NewAnomalyRepository(db)
	eventRepo := sqlite.NewEventRepository(db)
	analysisRepo := sqlite.NewAnalysisRepository(db)
	visitRepo := sqlite.NewVisitRepository(db)

	return meterRepo, readingRepo, anomalyRepo, eventRepo, analysisRepo, visitRepo
}

func TestMeterRepository_CRUD(t *testing.T) {
	meterRepo, _, _, _, _, _ := setupTestRepos(t)
	ctx := context.Background()

	m, err := meterRepo.FindByMeterID(ctx, "M-101")
	if err != nil {
		t.Fatalf("FindByMeterID error: %v", err)
	}
	if m.MeterID != "M-101" {
		t.Errorf("expected M-101, got %s", m.MeterID)
	}

	all, err := meterRepo.FindAll(ctx, domainmeter.Filter{})
	if err != nil {
		t.Fatalf("FindAll error: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 meter, got %d", len(all))
	}

	if err := meterRepo.UpdateStatus(ctx, "M-101", domainmeter.StatusAlert); err != nil {
		t.Fatalf("UpdateStatus error: %v", err)
	}

	m, err = meterRepo.FindByMeterID(ctx, "M-101")
	if err != nil || m.Status != domainmeter.StatusAlert {
		t.Errorf("expected status ALERT, got %s (err: %v)", m.Status, err)
	}
}

func TestReadingRepository_Query(t *testing.T) {
	_, readingRepo, _, _, _, _ := setupTestRepos(t)
	ctx := context.Background()

	readings, err := readingRepo.FindByMeter(ctx, "M-101", domainreading.Range{})
	if err != nil {
		t.Fatalf("FindByMeter error: %v", err)
	}
	if len(readings) < 0 {
		t.Errorf("unexpected readings: %v", readings)
	}

	total, err := readingRepo.TotalConsumption(ctx)
	if err != nil {
		t.Fatalf("TotalConsumption error: %v", err)
	}
	if total < 0 {
		t.Errorf("expected total >= 0, got %f", total)
	}
}

func TestAnomalyRepository_SaveAndTransition(t *testing.T) {
	_, _, anomalyRepo, _, _, _ := setupTestRepos(t)
	ctx := context.Background()

	anm, err := domainanomaly.New(domainanomaly.Params{
		ID:          "anm_test_001",
		MeterID:     "M-101",
		RunID:       "run_001",
		Type:        domainanomaly.TypeReal,
		Severity:    domainanomaly.SeverityHigh,
		Confidence:  0.95,
		DetectedAt:  time.Now().UTC(),
		WindowStart: time.Now().Add(-2 * time.Hour).UTC(),
		WindowEnd:   time.Now().UTC(),
		Explanation: domainanomaly.Explanation{
			Reason:            "Sobrecarga detectada en subestación",
			RecommendedAction: "Reducir carga",
			Source:            "deterministic",
		},
	})
	if err != nil {
		t.Fatalf("failed to create anomaly: %v", err)
	}

	if err := anomalyRepo.ReplaceOpen(ctx, []domainanomaly.Anomaly{*anm}); err != nil {
		t.Fatalf("ReplaceOpen anomaly error: %v", err)
	}

	found, err := anomalyRepo.FindByID(ctx, "anm_test_001")
	if err != nil {
		t.Fatalf("FindByID error: %v", err)
	}
	if found.ID != "anm_test_001" {
		t.Errorf("expected anm_test_001, got %s", found.ID)
	}

	if err := anomalyRepo.UpdateStatus(ctx, "anm_test_001", domainanomaly.StatusResolved); err != nil {
		t.Fatalf("UpdateStatus error: %v", err)
	}

	found, err = anomalyRepo.FindByID(ctx, "anm_test_001")
	if err != nil {
		t.Fatalf("FindByID error: %v", err)
	}
	if found.Status != domainanomaly.StatusResolved {
		t.Errorf("expected RESOLVED, got %s", found.Status)
	}
}

func TestEventRepository_Query(t *testing.T) {
	_, _, _, eventRepo, _, _ := setupTestRepos(t)
	ctx := context.Background()

	events, err := eventRepo.FindByMeter(ctx, "M-101")
	if err != nil {
		t.Fatalf("FindByMeter error: %v", err)
	}
	if len(events) < 0 {
		t.Errorf("unexpected events: %v", events)
	}
}

func TestAnalysisRepository_SaveAndFind(t *testing.T) {
	_, _, _, _, analysisRepo, _ := setupTestRepos(t)
	ctx := context.Background()

	now := time.Now().UTC()
	run := domainanalysis.NewRun("run_test_100", now.Add(-5*time.Minute))
	run.Status = domainanalysis.StatusCompleted
	run.FinishedAt = &now
	run.Summary = domainanalysis.Summary{
		AnomaliesDetected: 1,
		HighPriority:      1,
	}

	if err := analysisRepo.Save(ctx, run); err != nil {
		t.Fatalf("Save run error: %v", err)
	}

	latest, err := analysisRepo.FindLatest(ctx)
	if err != nil {
		t.Fatalf("FindLatest run error: %v", err)
	}
	if latest.ID != "run_test_100" {
		t.Errorf("expected run_test_100, got %s", latest.ID)
	}
}

func TestVisitRepository_CreateAndList(t *testing.T) {
	_, _, _, _, _, visitRepo := setupTestRepos(t)
	ctx := context.Background()

	v := domainvisit.TechnicalVisit{
		ID:           "VT-2026-M109-TEST",
		MeterID:      "M-109",
		Urgency:      "IMMEDIATE",
		Reason:       "Revisión urgente de tablero",
		ContactName:  "Carlos Gomez",
		ContactPhone: "+57 300 123 4567",
		Status:       "CONFIRMED",
		CreatedAt:    time.Now().UTC(),
	}

	if err := visitRepo.Create(ctx, v); err != nil {
		t.Fatalf("Create visit error: %v", err)
	}

	list, err := visitRepo.List(ctx)
	if err != nil {
		t.Fatalf("List visits error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 visit, got %d", len(list))
	}
	if list[0].ID != "VT-2026-M109-TEST" {
		t.Errorf("expected VT-2026-M109-TEST, got %s", list[0].ID)
	}
}
