package analysis

import (
	"context"
	"errors"
	"time"
)

type Status string

const (
	StatusPending   Status = "PENDING"
	StatusRunning   Status = "RUNNING"
	StatusCompleted Status = "COMPLETED"
	StatusFailed    Status = "FAILED"
)

type StepName string

// Pipeline de la prueba: Lecturas → Baseline → Detección → Correlación → Eventos → Explicación → Recomendación
const (
	StepReadings       StepName = "READINGS"
	StepBaseline       StepName = "BASELINE"
	StepDetection      StepName = "DETECTION"
	StepCorrelation    StepName = "CORRELATION"
	StepEvents         StepName = "EVENTS"
	StepExplanation    StepName = "EXPLANATION"
	StepRecommendation StepName = "RECOMMENDATION"
)

var pipeline = []struct {
	name  StepName
	label string
}{
	{StepReadings, "Lecturas"},
	{StepBaseline, "Baseline"},
	{StepDetection, "Detección"},
	{StepCorrelation, "Correlación"},
	{StepEvents, "Eventos"},
	{StepExplanation, "Explicación"},
	{StepRecommendation, "Recomendación"},
}

var (
	ErrNotFound       = errors.New("analysis run not found")
	ErrAlreadyRunning = errors.New("an analysis is already running")
	ErrUnknownStep    = errors.New("unknown step")
)

type Step struct {
	Name       StepName
	Label      string
	Status     Status
	StartedAt  *time.Time
	FinishedAt *time.Time
	Detail     string
}

type Summary struct {
	MetersAnalyzed    int
	ReadingsAnalyzed  int
	AnomaliesDetected int
	Actionable        int
	HighPriority      int
	AvgConfidence     float64
	ByType            map[string]int
	Explainer         string
	LLMExplained      int
	FallbackExplained int
}

type Run struct {
	ID         string
	Status     Status
	Steps      []Step
	StartedAt  time.Time
	FinishedAt *time.Time
	Summary    Summary
	Error      string
}

func NewRun(id string, now time.Time) *Run {
	steps := make([]Step, len(pipeline))
	for i, p := range pipeline {
		steps[i] = Step{Name: p.name, Label: p.label, Status: StatusPending}
	}
	return &Run{ID: id, Status: StatusRunning, Steps: steps, StartedAt: now}
}

func (r *Run) step(name StepName) (*Step, error) {
	for i := range r.Steps {
		if r.Steps[i].Name == name {
			return &r.Steps[i], nil
		}
	}
	return nil, ErrUnknownStep
}

func (r *Run) StartStep(name StepName, now time.Time) error {
	s, err := r.step(name)
	if err != nil {
		return err
	}
	s.Status, s.StartedAt = StatusRunning, &now
	return nil
}

func (r *Run) CompleteStep(name StepName, detail string, now time.Time) error {
	s, err := r.step(name)
	if err != nil {
		return err
	}
	s.Status, s.FinishedAt, s.Detail = StatusCompleted, &now, detail
	return nil
}

// Fail marca la corrida y el paso en curso como fallidos.
func (r *Run) Fail(err error, now time.Time) {
	for i := range r.Steps {
		if r.Steps[i].Status == StatusRunning {
			r.Steps[i].Status, r.Steps[i].FinishedAt = StatusFailed, &now
		}
	}
	r.Status, r.Error, r.FinishedAt = StatusFailed, err.Error(), &now
}

func (r *Run) Complete(sum Summary, now time.Time) {
	r.Status, r.Summary, r.FinishedAt = StatusCompleted, sum, &now
}

// Clone devuelve una copia profunda (el pipeline muta la corrida en otra goroutine).
func (r *Run) Clone() *Run {
	c := *r
	c.Steps = append([]Step(nil), r.Steps...)
	if r.Summary.ByType != nil {
		c.Summary.ByType = make(map[string]int, len(r.Summary.ByType))
		for k, v := range r.Summary.ByType {
			c.Summary.ByType[k] = v
		}
	}
	return &c
}

func (r *Run) Progress() float64 {
	done := 0
	for _, s := range r.Steps {
		if s.Status == StatusCompleted {
			done++
		}
	}
	return float64(done) / float64(len(r.Steps))
}

type Repository interface {
	Save(ctx context.Context, r *Run) error
	FindByID(ctx context.Context, id string) (*Run, error)
	FindLatest(ctx context.Context) (*Run, error)
}
