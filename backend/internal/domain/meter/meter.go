package meter

import (
	"context"
	"errors"
	"time"

	"energyhub/internal/domain/anomaly"
)

type Status string

const (
	StatusOK       Status = "OK"
	StatusAlert    Status = "ALERT"
	StatusCritical Status = "CRITICAL"
)

func (s Status) Valid() bool {
	switch s {
	case StatusOK, StatusAlert, StatusCritical:
		return true
	}
	return false
}

var ErrNotFound = errors.New("meter not found")

type Meter struct {
	ID        int64
	MeterID   string
	Name      string
	Location  string
	Status    Status
	CreatedAt time.Time
	Metrics   *Metrics // nil hasta que corre el primer análisis
}

// Metrics es la foto del medidor producida por el último análisis.
type Metrics struct {
	CurrentKWh     float64 // últimas 24 h
	BaselineKWh    float64 // consumo diario esperado
	VariationPct   float64
	PeriodKWh      float64 // total del periodo
	TopSeverity    string
	TopAnomalyType string
	AnalyzedAt     time.Time
}

type Snapshot struct {
	MeterID string
	Status  Status
	Metrics Metrics
}

// DeriveStatus: CRITICAL si hay una anomalía real de severidad alta; ALERT si hay algo accionable; OK en otro caso.
func DeriveStatus(items []anomaly.Anomaly) Status {
	status := StatusOK
	for _, a := range items {
		if !a.IsActionable() || a.Status == anomaly.StatusResolved {
			continue
		}
		if a.Type == anomaly.TypeReal && a.Severity == anomaly.SeverityHigh {
			return StatusCritical
		}
		status = StatusAlert
	}
	return status
}

type SortField string

const (
	SortMeterID     SortField = "meter_id"
	SortConsumption SortField = "consumption"
	SortVariation   SortField = "variation"
	SortSeverity    SortField = "severity"
)

func (s SortField) Valid() bool {
	switch s {
	case SortMeterID, SortConsumption, SortVariation, SortSeverity:
		return true
	}
	return false
}

type Filter struct {
	Status Status    // vacío = todos
	Search string    // búsqueda parcial por meter_id
	SortBy SortField // vacío = meter_id
	Desc   bool
}

type Repository interface {
	FindAll(ctx context.Context, f Filter) ([]Meter, error)
	FindByMeterID(ctx context.Context, meterID string) (*Meter, error)
	SaveSnapshots(ctx context.Context, snaps []Snapshot) error
	UpdateStatus(ctx context.Context, meterID string, s Status) error
}
