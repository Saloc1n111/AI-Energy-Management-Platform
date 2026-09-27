package copilot

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"energyhub/internal/domain/copilot"
)

type Explainer interface {
	ExplainQuery(ctx context.Context, q copilot.Question, extra map[string]interface{}) (copilot.Answer, error)
	Name() string
}

type Service struct {
	explainer Explainer
	fallback  Explainer
	timeout   time.Duration
	logger    *slog.Logger
}

func NewService(primary Explainer, fallback Explainer, timeout time.Duration, logger *slog.Logger) *Service {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &Service{
		explainer: primary,
		fallback:  fallback,
		timeout:   timeout,
		logger:    logger,
	}
}

func (s *Service) Ask(ctx context.Context, q copilot.Question) (copilot.Answer, error) {
	if strings.TrimSpace(q.Question) == "" {
		q.Question = "¿Qué significa lo que estoy viendo en esta tarjeta y qué debo hacer?"
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	if s.explainer != nil {
		ans, err := s.explainer.ExplainQuery(ctxTimeout, q, q.ContextData)
		if err == nil && ans.Answer != "" {
			return ans, nil
		}
		if s.logger != nil {
			s.logger.Warn("primary copilot failed; using fallback", "err", err)
		}
	}

	if s.fallback != nil {
		return s.fallback.ExplainQuery(ctx, q, q.ContextData)
	}

	return copilot.Answer{
		Answer: "Lo sentimos, el servicio de inteligencia artificial no se encuentra disponible temporalmente.",
		Source: "error",
	}, nil
}
