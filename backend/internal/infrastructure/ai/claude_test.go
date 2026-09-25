package ai_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	"energyhub/internal/infrastructure/ai"
)

func sampleFinding() detection.Finding {
	start := time.Date(2026, 9, 12, 14, 0, 0, 0, time.UTC)
	return detection.Finding{
		MeterID: "M-109", Type: anomaly.TypeReal, Severity: anomaly.SeverityHigh, Confidence: 0.93,
		WindowStart: start, WindowEnd: start.Add(57 * time.Hour),
		Segment: &detection.Segment{Start: start, Hours: 58, DeviationPct: 110.5, Direction: detection.DirectionUp},
		Metrics: detection.MeterMetrics{CurrentKWh: 2207.6, BaselineKWh: 1047.7, VariationPct: 110.7},
	}
}

func TestClaude_ParsesForcedToolUse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "test-key" || r.Header.Get("anthropic-version") != "2023-06-01" {
			t.Errorf("missing headers: %v", r.Header)
		}
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		if tc := body["tool_choice"].(map[string]any); tc["type"] != "tool" {
			t.Errorf("tool_choice not forced: %v", tc)
		}
		if !strings.Contains(string(raw), "M-109") {
			t.Error("facts not sent")
		}
		_, _ = w.Write([]byte(`{"content":[{"type":"tool_use","name":"report_anomaly_explanation","input":{
			"reason":"El consumo subió 110,5% sobre el baseline sin evento operativo.",
			"recommended_action":"Inspeccionar la instalación hoy.",
			"investigation_steps":["Revisar cargas","Verificar medidor"]}}],"stop_reason":"tool_use"}`))
	}))
	defer srv.Close()

	c := ai.NewClaude(ai.ClaudeConfig{APIKey: "test-key", Model: "test-model", BaseURL: srv.URL}, srv.Client())
	e, err := c.Explain(context.Background(), sampleFinding())
	if err != nil {
		t.Fatal(err)
	}
	if e.Source != "claude:test-model" || len(e.InvestigationSteps) != 2 {
		t.Fatalf("unexpected explanation: %+v", e)
	}
}

func TestFallback_UsesDeterministicWhenLLMFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"overloaded"}`, 529)
	}))
	defer srv.Close()

	claude := ai.NewClaude(ai.ClaudeConfig{APIKey: "k", Model: "m", BaseURL: srv.URL, Retries: 1}, srv.Client())
	fb := ai.NewFallback(claude, ai.NewDeterministic(), 5*time.Second, slog.New(slog.NewTextHandler(io.Discard, nil)))
	e, err := fb.Explain(context.Background(), sampleFinding())
	if err != nil {
		t.Fatal(err)
	}
	if e.Source != ai.SourceDeterministic || !strings.Contains(e.Reason, "110.5%") {
		t.Fatalf("fallback not applied: %+v", e)
	}
}

func TestClaude_RejectsInvalidOutput(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"content":[{"type":"tool_use","name":"report_anomaly_explanation","input":{"reason":"","recommended_action":"","investigation_steps":[]}}]}`))
	}))
	defer srv.Close()
	c := ai.NewClaude(ai.ClaudeConfig{APIKey: "k", Model: "m", BaseURL: srv.URL}, srv.Client())
	if _, err := c.Explain(context.Background(), sampleFinding()); err == nil {
		t.Fatal("expected validation error")
	}
}
