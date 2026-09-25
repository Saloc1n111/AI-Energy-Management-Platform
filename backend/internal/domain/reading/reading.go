package reading

import (
	"context"
	"time"
)

type Reading struct {
	MeterID        string
	Timestamp      time.Time
	ConsumptionKWh float64
	VoltageV       float64
	CurrentA       float64
	PowerFactor    float64
	Status         string
}

// ElectricalPowerKW estima la potencia activa a partir de las variables eléctricas: P = V·I·FP / 1000.
func (r Reading) ElectricalPowerKW() float64 {
	return r.VoltageV * r.CurrentA * r.PowerFactor / 1000
}

type Range struct {
	From, To *time.Time
}

func (rg Range) Contains(t time.Time) bool {
	if rg.From != nil && t.Before(*rg.From) {
		return false
	}
	if rg.To != nil && t.After(*rg.To) {
		return false
	}
	return true
}

type Repository interface {
	FindByMeter(ctx context.Context, meterID string, r Range) ([]Reading, error)
	// FindAll devuelve todas las lecturas agrupadas por medidor y ordenadas por timestamp.
	FindAll(ctx context.Context) (map[string][]Reading, error)
	TotalConsumption(ctx context.Context) (float64, error)
}
