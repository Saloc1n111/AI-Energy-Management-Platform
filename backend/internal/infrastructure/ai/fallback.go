package ai

import (
	"context"
	"log/slog"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
)

type explainer interface {
	Explain(ctx context.Context, f detection.Finding) (anomaly.Explanation, error)
	Name() string
}

// Fallback es un decorador: intenta el explainer primario (LLM) con timeout y,
// ante cualquier error, usa el secundario (determinista). Open/Closed: no modifica ninguno.
type Fallback struct {
	primary, secondary explainer
	timeout            time.Duration
	log                *slog.Logger
}

func NewFallback(primary, secondary explainer, timeout time.Duration, log *slog.Logger) *Fallback {
	return &Fallback{primary: primary, secondary: secondary, timeout: timeout, log: log}
}

func (f *Fallback) Name() string { return f.primary.Name() }

func (f *Fallback) Explain(ctx context.Context, fd detection.Finding) (anomaly.Explanation, error) {
	pctx, cancel := context.WithTimeout(ctx, f.timeout)
	defer cancel()
	e, err := f.primary.Explain(pctx, fd)
	if err == nil {
		return e, nil
	}
	f.log.Warn("primary explainer failed, using fallback", "meter", fd.MeterID, "explainer", f.primary.Name(), "err", err)
	return f.secondary.Explain(ctx, fd)
}
