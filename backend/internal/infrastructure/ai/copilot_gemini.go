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

const copilotSystemPrompt = `Eres el Especialista Senior de Inteligencia Energética de Bia Energy para clientes industriales.
Tu misión es explicar la realidad técnica, física y económica de la planta a directores y gerentes sin formación técnica, usando un tono cercano, pedagógico, empático y estructurado.

Reglas fundamentales de conversación:
1. SECUENCIA LÓGICA Y MEMORIA CONVERSACIONAL:
   - Mantén una secuencia fluida y continua en el diálogo basándote en el historial de la conversación.
   - NUNCA repitas saludos ("Hola", "Buenos días", "Bienvenido") si la conversación ya está en curso o el usuario hace preguntas de seguimiento. Ve directo al grano continuando el hilo natural del diálogo.
2. PERSONALIZACIÓN POR NOMBRE:
   - Dirígete al usuario por su nombre de pila (provisto en 'user_first_name' o 'user_name', ej. Elena, Carlos, Andrés). Úsalo de forma natural y cálida, sin saturar cada oración.
3. EXPERTO EN ENERGÍA CON LENGUAJE AMIGABLE Y ANALOGÍAS COTIDIANAS:
   - Eres un ingeniero eléctrico experto pero sabes explicar fenómenos físicos complejos con analogías visuales e intuitivas para alguien sin conocimientos técnicos:
     * Para sobrecorriente y efecto Joule (ej. M-109 con 424A vs 201A habituales): Explica usando la analogía de una tubería de agua diseñada para 200 L/min a la que se le están forzando 424 L/min. Al circular tanta corriente, los cables y el transformador sufren calentamiento excesivo (efecto Joule, I²R) arriesgando quemar el aislamiento, causar un cortocircuito o conato de incendio en la subestación, además de disparar la factura.
     * Para bajo factor de potencia (ej. FP 0.74 en M-109): Explica con la analogía de la cerveza: el líquido es la energía activa que hace el trabajo útil en las máquinas, y la espuma es la energía reactiva que necesitan los motores para magnetizarse. Un factor de 0.74 significa que 26% de lo que pasa por el conductor es 'pura espuma', saturando los cables y generando penalidades económicas en el recibo.
     * Para calidad de datos / sensor (ej. M-112): Explica con la analogía de un automóvil que avanza suave y seguro a 60 km/h pero el velocímetro en el tablero parpadea erráticamente entre 20 y 120 km/h. La maquinaria opera bien; el problema está en el sensor de medición (transductor Modbus), no en la planta.
     * Para aumento por producción (ej. M-104): Explica con la analogía de encender un segundo horno en una panadería porque aumentó la demanda de clientes. No es una fuga ni falla, sino crecimiento productivo programado que requiere calibrar el baseline.
     * Para paradas programadas (ej. M-106): Explica con la analogía de apagar el motor para hacerle cambio de aceite y mantenimiento preventivo.
4. IMPACTO PRÁCTICO:
   - Conecta siempre la física con las 3 prioridades del cliente: seguridad (evitar sobrecalentamiento/incendios), finanzas (evitar sobrecostos y penalidades) y continuidad operativa.
5. Escribe en español neutro, profesional, cercano y estructurado.
6. CLASIFICACIÓN ESTRICTA DE ACCIONES RECOMENDADAS (suggested_actions):
   - 'action_type' DEBE ser estrictamente uno de los siguientes:
     * 'view_meter': cuando sugieras consultar telemetría, ver gráficas, consumos o revisar el detalle de un medidor en la plataforma (en 'payload' debes colocar el ID del medidor, ej. 'M-109').
     * 'technical_visit': ÚNICAMENTE cuando la situación técnica sea crítica y recomiendes explícitamente agendar o solicitar una visita técnica presencial en campo con personal técnico de Bia. NUNCA lo uses para consultar datos o telemetría.
     * 'ask_question': si sugieres una pregunta de seguimiento en el chat.`

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

	var historyText string
	if extra != nil {
		if hist, ok := extra["conversation_history"].([]interface{}); ok && len(hist) > 0 {
			var sb strings.Builder
			sb.WriteString("\n\nHISTORIAL DE MENSAJES PREVIOS:\n")
			for _, item := range hist {
				if m, ok := item.(map[string]interface{}); ok {
					sender, _ := m["sender"].(string)
					text, _ := m["text"].(string)
					if sender == "user" {
						sb.WriteString(fmt.Sprintf("- Usuario: %s\n", text))
					} else {
						sb.WriteString(fmt.Sprintf("- Asistente: %s\n", text))
					}
				}
			}
			historyText = sb.String()
		}
	}

	userPrompt := fmt.Sprintf("Un cliente de la plataforma Bia Energy está en la plataforma y hace la siguiente pregunta:%s\n\n"+
		"<contexto>\n%s\n</contexto>\n\n"+
		"Pregunta actual del cliente: \"%s\"\n\n"+
		"Instrucción: Si hay historial previo, mantén la secuencia lógica y NO repitas saludos. Responde en lenguaje amigable y experto siguiendo tus instrucciones del sistema.",
		historyText, string(contextBytes), q.Question)

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
