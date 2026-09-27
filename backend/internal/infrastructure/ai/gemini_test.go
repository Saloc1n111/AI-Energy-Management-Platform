package ai_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	"energyhub/internal/infrastructure/ai"
)

func TestGemini_ParsesStructuredOutput(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(raw), "M-109") {
			t.Error("facts not included in request")
		}
		var req map[string]any
		_ = json.Unmarshal(raw, &req)
		gc, ok := req["generationConfig"].(map[string]any)
		if !ok || gc["response_mime_type"] != "application/json" {
			t.Errorf("response_mime_type not application/json: %v", gc)
		}

		responseBody := `{
			"candidates": [{
				"content": {
					"parts": [{
						"text": "{\"reason\":\"El consumo subió 110.5% debido a sobrecarga en M-109.\",\"recommended_action\":\"Inspeccionar tablero hoy.\",\"investigation_steps\":[\"Revisar cables\",\"Validar medidor\"]}"
					}]
				},
				"finishReason": "STOP"
			}]
		}`
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(responseBody))
	}))
	defer srv.Close()

	g := ai.NewGemini(ai.GeminiConfig{
		APIKey:  "test-api-key",
		Model:   "gemini-2.0-flash",
		BaseURL: srv.URL,
	}, srv.Client())

	start := time.Date(2026, 9, 12, 14, 0, 0, 0, time.UTC)
	finding := detection.Finding{
		MeterID: "M-109", Type: anomaly.TypeReal, Severity: anomaly.SeverityHigh, Confidence: 0.93,
		WindowStart: start, WindowEnd: start.Add(58 * time.Hour),
		Segment: &detection.Segment{Start: start, Hours: 58, DeviationPct: 110.5, Direction: detection.DirectionUp},
		Metrics: detection.MeterMetrics{CurrentKWh: 2207.6, BaselineKWh: 1047.7, VariationPct: 110.7},
	}

	exp, err := g.Explain(context.Background(), finding)
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}
	if exp.Source != "gemini:gemini-2.0-flash" {
		t.Errorf("expected source gemini:gemini-2.0-flash, got %s", exp.Source)
	}
	if exp.Reason == "" || exp.RecommendedAction == "" || len(exp.InvestigationSteps) != 2 {
		t.Errorf("incomplete explanation parsed: %+v", exp)
	}
}

// TestGemini_LiveCall llama a la API real de Google Gemini si GEMINI_API_KEY está configurada en el entorno o en .env.
func TestGemini_LiveCall(t *testing.T) {
	key := os.Getenv("GEMINI_API_KEY")
	if key == "" {
		for _, path := range []string{"../../../.env", "../../.env", "../.env", ".env"} {
			if data, err := os.ReadFile(path); err == nil {
				for _, line := range strings.Split(string(data), "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "GEMINI_API_KEY=") {
						key = strings.TrimSpace(strings.TrimPrefix(line, "GEMINI_API_KEY="))
						break
					}
				}
			}
			if key != "" {
				break
			}
		}
	}
	if key == "" {
		t.Skip("skipping live test: GEMINI_API_KEY not set")
	}

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		for _, path := range []string{"../../../.env", "../../.env", "../.env", ".env"} {
			if data, err := os.ReadFile(path); err == nil {
				for _, line := range strings.Split(string(data), "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "GEMINI_MODEL=") {
						model = strings.TrimSpace(strings.TrimPrefix(line, "GEMINI_MODEL="))
						break
					}
				}
			}
			if model != "" {
				break
			}
		}
	}
	if model == "" {
		model = "gemini-3.8-flash"
	}

	g := ai.NewGemini(ai.GeminiConfig{
		APIKey:  key,
		Model:   model,
		Retries: 1,
	}, &http.Client{Timeout: 20 * time.Second})

	start := time.Date(2026, 9, 12, 14, 0, 0, 0, time.UTC)
	finding := detection.Finding{
		MeterID: "M-109", Type: anomaly.TypeReal, Severity: anomaly.SeverityHigh, Confidence: 0.93,
		WindowStart: start, WindowEnd: start.Add(58 * time.Hour),
		Segment: &detection.Segment{Start: start, Hours: 58, DeviationPct: 110.5, Direction: detection.DirectionUp},
		Metrics: detection.MeterMetrics{CurrentKWh: 2207.6, BaselineKWh: 1047.7, VariationPct: 110.7},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	t.Logf("Enviando petición a Google Gemini (modelo: %s)...", model)
	exp, err := g.Explain(ctx, finding)
	if err != nil {
		if strings.Contains(err.Error(), "RESOURCE_EXHAUSTED") || strings.Contains(err.Error(), "402") || strings.Contains(err.Error(), "429") {
			t.Skipf("skipping live test due to API quota/credit depletion: %v", err)
		}
		t.Fatalf("Live Gemini call failed: %v", err)
	}

	t.Logf("¡Respuesta exitosa de Google Gemini!")
	t.Logf("Source: %s", exp.Source)
	t.Logf("Reason: %s", exp.Reason)
	t.Logf("Action: %s", exp.RecommendedAction)
	t.Logf("Steps: %v", exp.InvestigationSteps)
}
