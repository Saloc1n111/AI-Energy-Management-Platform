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

	"energyhub/internal/domain/copilot"
)

const copilotSystemPrompt = `Eres el Asesor Senior de Inteligencia Energética de Bia Energy para clientes empresariales (SaaS).
Tu objetivo es responder dudas sobre el consumo, medidores, alertas y finanzas energéticas de manera humana, clara, empática y 100% comprensible para un usuario NO TÉCNICO (directores de operaciones, gerentes generales, administradores y jefes de planta).

Reglas fundamentales:
1. NUNCA uses tecnicismos matemáticos ni eléctricos intimidantes (evita Z-Score, MAD, desviación estándar, cos phi, transductores, armónicos) a menos que el usuario pregunte específicamente por ellos.
2. Traduce los datos a impacto real: dinero en la factura, seguridad de la planta, continuidad operativa y desgaste de equipos.
3. Si el usuario pregunta por el medidor M-109, recuérdale que el consumo se duplicó (+110%) sin justificación. Pregúntale si hubo cambios en la producción o equipos nuevos; si no los hubo, recomiéndale de forma enfática solicitar una visita técnica para evitar riesgos.
4. Si el medidor es M-112, aclara que sus máquinas operan bien y que es solo una inconsistencia en el sensor de medición.
5. Si el medidor es M-106, tranquiliza al cliente explicando que es una parada por mantenimiento normal.
6. Si es M-104, explícale que el aumento coincide con la nueva línea de producción y es un crecimiento productivo normal.
7. Escribe en español neutro, profesional y cercano.`

type CopilotGemini struct {
	cfg  GeminiConfig
	http *http.Client
}

func NewCopilotGemini(cfg GeminiConfig, client *http.Client) *CopilotGemini {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://generativelanguage.googleapis.com"
	}
	if cfg.Model == "" {
		cfg.Model = "gemini-3.5-flash-lite"
	}
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &CopilotGemini{cfg: cfg, http: client}
}

func (g *CopilotGemini) Name() string {
	return "gemini:copilot:" + g.cfg.Model
}

type geminiCopilotResponse struct {
	Answer            string           `json:"answer"`
	KeyTakeaways      []string         `json:"key_takeaways"`
	FollowUpQuestions []string         `json:"follow_up_questions"`
	SuggestedActions  []copilot.Action `json:"suggested_actions"`
}

func (g *CopilotGemini) ExplainQuery(ctx context.Context, q copilot.Question, extra map[string]interface{}) (copilot.Answer, error) {
	contextBytes, _ := json.MarshalIndent(map[string]interface{}{
		"context_type": q.ContextType,
		"context_id":   q.ContextID,
		"user_query":   q.Question,
		"extra_data":   extra,
	}, "", "  ")

	userPrompt := fmt.Sprintf("Un cliente de la plataforma Bia Energy está viendo una card/elemento y hace la siguiente pregunta:\n\n"+
		"<contexto>\n%s\n</contexto>\n\n"+
		"Pregunta del cliente: \"%s\"\n\n"+
		"Responde en lenguaje claro, empático y no técnico siguiendo tus instrucciones del sistema.",
		string(contextBytes), q.Question)

	reqBody := geminiRequest{
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: copilotSystemPrompt}},
		},
		Contents: []geminiContent{
			{
				Parts: []geminiPart{{Text: userPrompt}},
			},
		},
		GenerationConfig: geminiGenConfig{
			ResponseMimeType: "application/json",
			ResponseSchema: geminiSchema{
				Type: "OBJECT",
				Properties: map[string]geminiSchema{
					"answer": {Type: "STRING"},
					"key_takeaways": {
						Type:  "ARRAY",
						Items: &geminiSchema{Type: "STRING"},
					},
					"follow_up_questions": {
						Type:  "ARRAY",
						Items: &geminiSchema{Type: "STRING"},
					},
					"suggested_actions": {
						Type: "ARRAY",
						Items: &geminiSchema{
							Type: "OBJECT",
							Properties: map[string]geminiSchema{
								"id":          {Type: "STRING"},
								"label":       {Type: "STRING"},
								"action_type": {Type: "STRING"},
								"payload":     {Type: "STRING"},
								"description": {Type: "STRING"},
							},
							Required: []string{"id", "label", "action_type"},
						},
					},
				},
				Required: []string{"answer", "key_takeaways", "follow_up_questions"},
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return copilot.Answer{}, fmt.Errorf("marshal request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s",
		strings.TrimRight(g.cfg.BaseURL, "/"),
		url.PathEscape(g.cfg.Model),
		url.QueryEscape(g.cfg.APIKey),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return copilot.Answer{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.http.Do(req)
	if err != nil {
		return copilot.Answer{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return copilot.Answer{}, err
	}

	if resp.StatusCode != http.StatusOK {
		return copilot.Answer{}, fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(body))
	}

	var res geminiResponse
	if err := json.Unmarshal(body, &res); err != nil {
		return copilot.Answer{}, fmt.Errorf("decode gemini response: %w", err)
	}
	if len(res.Candidates) == 0 || len(res.Candidates[0].Content.Parts) == 0 {
		return copilot.Answer{}, errors.New("gemini returned no content candidates")
	}

	rawText := res.Candidates[0].Content.Parts[0].Text
	var parsed geminiCopilotResponse
	if err := json.Unmarshal([]byte(rawText), &parsed); err != nil {
		return copilot.Answer{}, fmt.Errorf("unmarshal gemini copilot json: %w", err)
	}

	if strings.TrimSpace(parsed.Answer) == "" {
		return copilot.Answer{}, errors.New("empty answer from gemini")
	}

	return copilot.Answer{
		Answer:            strings.TrimSpace(parsed.Answer),
		KeyTakeaways:      parsed.KeyTakeaways,
		SuggestedActions:  parsed.SuggestedActions,
		FollowUpQuestions: parsed.FollowUpQuestions,
		Source:            g.Name(),
		ContextID:         q.ContextID,
	}, nil
}
