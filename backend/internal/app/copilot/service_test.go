package copilot_test

import (
	"context"
	"testing"
	"time"

	appcopilot "energyhub/internal/app/copilot"
	"energyhub/internal/domain/copilot"
	"energyhub/internal/infrastructure/ai"
)

func TestCopilot_DeterministicFallback_M109(t *testing.T) {
	fallback := ai.NewCopilotDeterministic()
	svc := appcopilot.NewService(nil, fallback, 5*time.Second, nil)

	ans, err := svc.Ask(context.Background(), copilot.Question{
		ContextType: copilot.ContextMeter,
		ContextID:   "M-109",
		Question:    "¿Por qué aumentó tanto el consumo?",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(ans.KeyTakeaways) == 0 {
		t.Errorf("expected takeaways, got empty")
	}
	if len(ans.SuggestedActions) == 0 {
		t.Errorf("expected suggested actions, got empty")
	}
	if ans.ContextID != "M-109" {
		t.Errorf("expected context M-109, got %s", ans.ContextID)
	}
}

func TestCopilot_DeterministicFallback_KPI(t *testing.T) {
	fallback := ai.NewCopilotDeterministic()
	svc := appcopilot.NewService(nil, fallback, 5*time.Second, nil)

	ans, err := svc.Ask(context.Background(), copilot.Question{
		ContextType: copilot.ContextKPI,
		ContextID:   "total_consumption",
		Question:    "¿Cómo está el consumo general?",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ans.ContextID != "total_consumption" {
		t.Errorf("expected total_consumption, got %s", ans.ContextID)
	}
}
