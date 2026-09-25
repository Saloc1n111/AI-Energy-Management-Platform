package meters

import (
	"context"
	"errors"

	"energyhub/internal/domain/detection"
	"energyhub/internal/domain/meter"
	"energyhub/internal/domain/reading"
)

type Service struct {
	meters   meter.Repository
	readings reading.Repository
	cfg      detection.Config
}

func NewService(m meter.Repository, r reading.Repository, cfg detection.Config) *Service {
	return &Service{meters: m, readings: r, cfg: cfg}
}

// Detail agrega al medidor su baseline calculado al vuelo (barato: 336 lecturas).
type Detail struct {
	Meter    meter.Meter
	Baseline *detection.Profile
}

// Point es una lectura con el consumo esperado para esa hora (para graficar real vs baseline).
type Point struct {
	reading.Reading
	ExpectedKWh float64
}

func (s *Service) List(ctx context.Context, f meter.Filter) ([]meter.Meter, error) {
	return s.meters.FindAll(ctx, f)
}

func (s *Service) Get(ctx context.Context, meterID string) (*Detail, error) {
	m, err := s.meters.FindByMeterID(ctx, meterID)
	if err != nil {
		return nil, err
	}
	d := &Detail{Meter: *m}
	rs, err := s.readings.FindByMeter(ctx, meterID, reading.Range{})
	if err != nil {
		return nil, err
	}
	if p, err := detection.BuildProfile(meterID, detection.SortReadings(rs), s.cfg); err == nil {
		d.Baseline = &p
	} else if !errors.Is(err, detection.ErrInsufficientData) {
		return nil, err
	}
	return d, nil
}

func (s *Service) Readings(ctx context.Context, meterID string, rg reading.Range) ([]Point, error) {
	if _, err := s.meters.FindByMeterID(ctx, meterID); err != nil {
		return nil, err // 404 en lugar de lista vacía para un medidor inexistente
	}
	all, err := s.readings.FindByMeter(ctx, meterID, reading.Range{})
	if err != nil {
		return nil, err
	}
	all = detection.SortReadings(all)
	prof, perr := detection.BuildProfile(meterID, all, s.cfg)
	out := make([]Point, 0, len(all))
	for _, r := range all {
		if !rg.Contains(r.Timestamp) {
			continue
		}
		p := Point{Reading: r}
		if perr == nil {
			p.ExpectedKWh = prof.ExpectedKWh(r.Timestamp)
		}
		out = append(out, p)
	}
	return out, nil
}
