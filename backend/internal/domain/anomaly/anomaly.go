package anomaly

import (
	"context"
	"errors"
	"time"
)

type Type string

const (
	TypeReal          Type = "REAL_ANOMALY"
	TypeExplainable   Type = "EXPLAINABLE_ANOMALY"
	TypeFalsePositive Type = "FALSE_POSITIVE"
	TypeDataQuality   Type = "DATA_QUALITY"
)

func (t Type) Valid() bool {
	switch t {
	case TypeReal, TypeExplainable, TypeFalsePositive, TypeDataQuality:
		return true
	}
	return false
}

type Severity string

const (
	SeverityLow    Severity = "LOW"
	SeverityMedium Severity = "MEDIUM"
	SeverityHigh   Severity = "HIGH"
)

func (s Severity) Valid() bool { return s.Weight() > 0 }

func (s Severity) Weight() int {
	switch s {
	case SeverityHigh:
		return 3
	case SeverityMedium:
		return 2
	case SeverityLow:
		return 1
	}
	return 0
}

type Status string

const (
	StatusOpen         Status = "OPEN"
	StatusAcknowledged Status = "ACKNOWLEDGED"
	StatusResolved     Status = "RESOLVED"
)

func (s Status) Valid() bool {
	return s == StatusOpen || s == StatusAcknowledged || s == StatusResolved
}

// Evidence: un dato medible que sustenta la conclusión.
type Evidence struct {
	Metric       string
	Unit         string
	Baseline     float64
	Observed     float64
	DeviationPct float64
	Note         string
}

// ConfidenceFactor: cada aporte a la confianza queda trazado ("¿por qué la IA llegó a esa conclusión?").
type ConfidenceFactor struct {
	Name   string
	Weight float64
	Detail string
}

type EventRef struct {
	Type        string
	Timestamp   time.Time
	Description string
}

type Explanation struct {
	Reason             string
	RecommendedAction  string
	InvestigationSteps []string
	Source             string // "deterministic" o "claude:<modelo>"
}

var (
	ErrNotFound          = errors.New("anomaly not found")
	ErrMissingMeter      = errors.New("meter_id is required")
	ErrInvalidType       = errors.New("invalid anomaly type")
	ErrInvalidSeverity   = errors.New("invalid severity")
	ErrInvalidConfidence = errors.New("confidence must be between 0 and 1")
	ErrInvalidTransition = errors.New("invalid status transition")
)

type Anomaly struct {
	ID                string
	RunID             string
	MeterID           string
	DetectedAt        time.Time
	WindowStart       time.Time
	WindowEnd         time.Time
	Type              Type
	Severity          Severity
	Confidence        float64
	ConfidenceFactors []ConfidenceFactor
	Signals           []string
	Evidence          []Evidence
	RelatedEvent      *EventRef
	Explanation       Explanation
	Status            Status
}

type Params struct {
	ID, RunID, MeterID     string
	DetectedAt             time.Time
	WindowStart, WindowEnd time.Time
	Type                   Type
	Severity               Severity
	Confidence             float64
	ConfidenceFactors      []ConfidenceFactor
	Signals                []string
	Evidence               []Evidence
	RelatedEvent           *EventRef
	Explanation            Explanation
}

// New es la única forma válida de crear una anomalía: garantiza invariantes.
func New(p Params) (*Anomaly, error) {
	switch {
	case p.MeterID == "":
		return nil, ErrMissingMeter
	case !p.Type.Valid():
		return nil, ErrInvalidType
	case !p.Severity.Valid():
		return nil, ErrInvalidSeverity
	case p.Confidence < 0 || p.Confidence > 1:
		return nil, ErrInvalidConfidence
	}
	return &Anomaly{
		ID: p.ID, RunID: p.RunID, MeterID: p.MeterID, DetectedAt: p.DetectedAt,
		WindowStart: p.WindowStart, WindowEnd: p.WindowEnd,
		Type: p.Type, Severity: p.Severity, Confidence: p.Confidence,
		ConfidenceFactors: p.ConfidenceFactors, Signals: p.Signals, Evidence: p.Evidence,
		RelatedEvent: p.RelatedEvent, Explanation: p.Explanation, Status: StatusOpen,
	}, nil
}

// IsActionable: un falso positivo se registra pero no se escala.
func (a Anomaly) IsActionable() bool { return a.Type != TypeFalsePositive }

// typeRank: a igual severidad, una anomalía real (riesgo físico y costo) va antes que un
// problema de medición, y este antes que un cambio ya explicado por la operación.
func (t Type) rank() int {
	switch t {
	case TypeReal:
		return 3
	case TypeDataQuality:
		return 2
	case TypeExplainable:
		return 1
	}
	return 0
}

// PriorityScore ordena lexicográficamente: severidad > tipo > confianza.
// Un falso positivo nunca escala.
func (a Anomaly) PriorityScore() float64 {
	if !a.IsActionable() {
		return 0
	}
	return float64(a.Severity.Weight()*10+a.Type.rank()) + a.Confidence
}

func (a Anomaly) RequiresAttention() bool {
	return a.IsActionable() && a.Severity == SeverityHigh
}

// TransitionTo aplica el ciclo de vida OPEN → ACKNOWLEDGED → RESOLVED (con reapertura).
func (a *Anomaly) TransitionTo(to Status) error {
	allowed := map[Status][]Status{
		StatusOpen:         {StatusAcknowledged, StatusResolved},
		StatusAcknowledged: {StatusResolved, StatusOpen},
		StatusResolved:     {StatusOpen},
	}
	for _, s := range allowed[a.Status] {
		if s == to {
			a.Status = to
			return nil
		}
	}
	return ErrInvalidTransition
}

func ConfidenceLabel(c float64) string {
	switch {
	case c >= 0.8:
		return "HIGH"
	case c >= 0.6:
		return "MEDIUM"
	}
	return "LOW"
}

type Filter struct {
	MeterID  string
	Type     Type
	Severity Severity
	Status   Status
}

type Repository interface {
	// ReplaceOpen sincroniza el resultado de un análisis: inserta/actualiza las anomalías
	// detectadas (conservando el estado si ya existían) y elimina las OPEN que ya no aplican.
	ReplaceOpen(ctx context.Context, items []Anomaly) error
	UpdateStatus(ctx context.Context, id string, s Status) error
	FindAll(ctx context.Context, f Filter) ([]Anomaly, error)
	FindByID(ctx context.Context, id string) (*Anomaly, error)
}
