package dashboard

import (
	"context"
	"errors"
	"sort"

	"energyhub/internal/domain/analysis"
	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/meter"
	"energyhub/internal/domain/reading"
)

type Summary struct {
	TotalMeters         int
	MetersByStatus      map[string]int
	TotalConsumptionKWh float64
	AnomaliesDetected   int
	Actionable          int
	HighPriority        int
	AvgConfidence       float64
	ByType              map[string]int
	TopPriority         []anomaly.Anomaly
	LastAnalysis        *analysis.Run
}

type Service struct {
	meters    meter.Repository
	readings  reading.Repository
	anomalies anomaly.Repository
	runs      analysis.Repository
}

func NewService(m meter.Repository, r reading.Repository, a anomaly.Repository, runs analysis.Repository) *Service {
	return &Service{meters: m, readings: r, anomalies: a, runs: runs}
}

func (s *Service) Summary(ctx context.Context) (*Summary, error) {
	ms, err := s.meters.FindAll(ctx, meter.Filter{})
	if err != nil {
		return nil, err
	}
	total, err := s.readings.TotalConsumption(ctx)
	if err != nil {
		return nil, err
	}
	items, err := s.anomalies.FindAll(ctx, anomaly.Filter{})
	if err != nil {
		return nil, err
	}
	sum := &Summary{
		TotalMeters: len(ms), MetersByStatus: map[string]int{}, TotalConsumptionKWh: total,
		ByType: map[string]int{}, TopPriority: []anomaly.Anomaly{},
	}
	for _, m := range ms {
		sum.MetersByStatus[string(m.Status)]++
	}
	conf := 0.0
	for _, a := range items {
		if a.Status == anomaly.StatusResolved {
			continue
		}
		sum.AnomaliesDetected++
		sum.ByType[string(a.Type)]++
		conf += a.Confidence
		if a.IsActionable() {
			sum.Actionable++
			sum.TopPriority = append(sum.TopPriority, a)
		}
		if a.RequiresAttention() {
			sum.HighPriority++
		}
	}
	if sum.AnomaliesDetected > 0 {
		sum.AvgConfidence = float64(int(conf/float64(sum.AnomaliesDetected)*100+0.5)) / 100
	}
	sort.SliceStable(sum.TopPriority, func(i, j int) bool {
		return sum.TopPriority[i].PriorityScore() > sum.TopPriority[j].PriorityScore()
	})
	if len(sum.TopPriority) > 3 {
		sum.TopPriority = sum.TopPriority[:3]
	}
	run, err := s.runs.FindLatest(ctx)
	switch {
	case err == nil:
		sum.LastAnalysis = run
	case !errors.Is(err, analysis.ErrNotFound):
		return nil, err
	}
	return sum, nil
}
