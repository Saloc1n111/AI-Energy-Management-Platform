package visits_test

import (
	"context"
	"testing"

	appvisits "energyhub/internal/app/visits"
	domainvisit "energyhub/internal/domain/visit"
)

type mockRepo struct {
	visits []domainvisit.TechnicalVisit
}

func (m *mockRepo) Create(ctx context.Context, v domainvisit.TechnicalVisit) error {
	m.visits = append(m.visits, v)
	return nil
}

func (m *mockRepo) List(ctx context.Context) ([]domainvisit.TechnicalVisit, error) {
	return m.visits, nil
}

func TestVisits_CreateAndList(t *testing.T) {
	repo := &mockRepo{}
	svc := appvisits.NewService(repo)

	created, err := svc.Create(context.Background(), appvisits.CreateVisitRequest{
		MeterID:      "M-109",
		Urgency:      "IMMEDIATE",
		Reason:       "Aumento inusual no reconocido",
		ContactName:  "Carlos Gomez",
		ContactPhone: "+57 310 123 4567",
		Notes:        "Favor verificar tablero general",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if created.ID == "" {
		t.Errorf("expected ticket ID, got empty")
	}
	if created.MeterID != "M-109" {
		t.Errorf("expected M-109, got %s", created.MeterID)
	}

	list, err := svc.List(context.Background())
	if err != nil {
		t.Fatalf("unexpected list error: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("expected 1 visit, got %d", len(list))
	}
}

func TestVisits_Create_RequiresMeterID(t *testing.T) {
	repo := &mockRepo{}
	svc := appvisits.NewService(repo)

	_, err := svc.Create(context.Background(), appvisits.CreateVisitRequest{
		MeterID: "",
	})
	if err == nil {
		t.Fatal("expected error when meter_id is empty, got nil")
	}
	if err != appvisits.ErrMeterRequired {
		t.Errorf("expected ErrMeterRequired, got %v", err)
	}
}
