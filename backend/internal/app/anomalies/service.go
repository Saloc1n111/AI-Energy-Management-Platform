package anomalies

import (
	"context"
	"sort"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/meter"
)

type Service struct {
	repo   anomaly.Repository
	meters meter.Repository
}

func NewService(r anomaly.Repository, m meter.Repository) *Service {
	return &Service{repo: r, meters: m}
}

// List devuelve las anomalías ordenadas por prioridad (regla de dominio, no de SQL).
func (s *Service) List(ctx context.Context, f anomaly.Filter) ([]anomaly.Anomaly, error) {
	items, err := s.repo.FindAll(ctx, f)
	if err != nil {
		return nil, err
	}
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].PriorityScore() > items[j].PriorityScore()
	})
	return items, nil
}

func (s *Service) Get(ctx context.Context, id string) (*anomaly.Anomaly, error) {
	return s.repo.FindByID(ctx, id)
}

// ChangeStatus es la "Acción" del flujo: reconocer o resolver, y recalcular el estado del medidor.
func (s *Service) ChangeStatus(ctx context.Context, id string, to anomaly.Status) (*anomaly.Anomaly, error) {
	a, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := a.TransitionTo(to); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateStatus(ctx, id, to); err != nil {
		return nil, err
	}
	siblings, err := s.repo.FindAll(ctx, anomaly.Filter{MeterID: a.MeterID})
	if err != nil {
		return nil, err
	}
	if err := s.meters.UpdateStatus(ctx, a.MeterID, meter.DeriveStatus(siblings)); err != nil {
		return nil, err
	}
	return a, nil
}
