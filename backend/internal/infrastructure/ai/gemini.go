package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
)

type GeminiConfig struct {
	APIKey  string
	Model   string
	BaseURL string
	Retries int
}

// Gemini conecta con la API de Google Gemini (v1beta generateContent)
// con respuesta estructurada forzada (response_mime_type: application/json)
// para garantizar invariantes y robustez sin alucinaciones de formato.
type Gemini struct {
	cfg  GeminiConfig
	http *http.Client
}

func NewGemini(cfg GeminiConfig, client *http.Client) *Gemini {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://generativelanguage.googleapis.com"
	}
	if cfg.Model == "" {
		cfg.Model = "gemini-3.5-flash-lite"
	}
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &Gemini{cfg: cfg, http: client}
}

func (g *Gemini) Name() string { return "gemini:" + g.cfg.Model }

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiSchema struct {
	Type       string                  `json:"type"`
	Properties map[string]geminiSchema `json:"properties,omitempty"`
	Items      *geminiSchema           `json:"items,omitempty"`
	Required   []string                `json:"required,omitempty"`
}

type geminiGenConfig struct {
	ResponseMimeType string       `json:"response_mime_type"`
	ResponseSchema   geminiSchema `json:"response_schema"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"system_instruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  geminiGenConfig `json:"generationConfig"`
}

type geminiCandidate struct {
	Content struct {
		Parts []geminiPart `json:"parts"`
	} `json:"content"`
	FinishReason string `json:"finishReason"`
}

type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
	Error      *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type geminiExplanation struct {
	Reason             string   `json:"reason"`
	RecommendedAction  string   `json:"recommended_action"`
	InvestigationSteps []string `json:"investigation_steps"`
}

func (g *Gemini) Explain(ctx context.Context, f detection.Finding) (anomaly.Explanation, error) {
	factsJSON, err := json.MarshalIndent(BuildFacts(f), "", "  ")
	if err != nil {
		return anomaly.Explanation{}, fmt.Errorf("marshal facts: %w", err)
	}

	reqBody := geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: fmt.Sprintf("Genera la explicación para la siguiente anomalía energética:\n\n<facts>\n%s\n</facts>", string(factsJSON))},
				},
			},
		},
		GenerationConfig: geminiGenConfig{
			ResponseMimeType: "application/json",
			ResponseSchema: geminiSchema{
				Type: "OBJECT",
				Properties: map[string]geminiSchema{
					"reason": {
						Type: "STRING",
					},
					"recommended_action": {
						Type: "STRING",
					},
					"investigation_steps": {
						Type:  "ARRAY",
						Items: &geminiSchema{Type: "STRING"},
					},
				},
				Required: []string{"reason", "recommended_action", "investigation_steps"},
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return anomaly.Explanation{}, fmt.Errorf("marshal request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s",
		strings.TrimRight(g.cfg.BaseURL, "/"),
		url.PathEscape(g.cfg.Model),
		url.QueryEscape(g.cfg.APIKey),
	)

	var lastErr error
	for attempt := 0; attempt <= g.cfg.Retries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
		if err != nil {
			return anomaly.Explanation{}, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := g.http.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		if resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests {
			lastErr = fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(body))
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return anomaly.Explanation{}, fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(body))
		}

		var res geminiResponse
		if err := json.Unmarshal(body, &res); err != nil {
			return anomaly.Explanation{}, fmt.Errorf("decode gemini response: %w", err)
		}
		if res.Error != nil {
			return anomaly.Explanation{}, fmt.Errorf("gemini api error [%d]: %s", res.Error.Code, res.Error.Message)
		}
		if len(res.Candidates) == 0 || len(res.Candidates[0].Content.Parts) == 0 {
			return anomaly.Explanation{}, errors.New("gemini returned no content candidates")
		}

		text := res.Candidates[0].Content.Parts[0].Text
		var parsed geminiExplanation
		if err := json.Unmarshal([]byte(text), &parsed); err != nil {
			return anomaly.Explanation{}, fmt.Errorf("unmarshal gemini json: %w (raw: %s)", err, text)
		}

		if strings.TrimSpace(parsed.Reason) == "" || strings.TrimSpace(parsed.RecommendedAction) == "" {
			return anomaly.Explanation{}, errors.New("gemini returned empty reason or recommended action")
		}

		return anomaly.Explanation{
			Reason:             strings.TrimSpace(parsed.Reason),
			RecommendedAction:  strings.TrimSpace(parsed.RecommendedAction),
			InvestigationSteps: parsed.InvestigationSteps,
			Source:             g.Name(),
		}, nil
	}

	return anomaly.Explanation{}, lastErr
}
