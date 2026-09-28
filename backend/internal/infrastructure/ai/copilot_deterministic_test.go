package ai_test

import (
	"context"
	"strings"
	"testing"

	"energyhub/internal/domain/copilot"
	"energyhub/internal/infrastructure/ai"
)

func TestCopilotDeterministic_ConversationalSequenceAndNoGreetingRepetition(t *testing.T) {
	c := ai.NewCopilotDeterministic()
	ctx := context.Background()

	// 1. Primer turno sin historial: debe saludar y personalizar por nombre
	q1 := copilot.Question{
		ContextType: copilot.ContextGeneral,
		ContextID:   "global",
		Question:    "Hola, ¿cómo está la planta hoy?",
	}
	extra1 := map[string]interface{}{
		"user_name":       "Ing. Elena Morales",
		"user_first_name": "Elena",
		"total_meters":    12,
	}

	ans1, err := c.ExplainQuery(ctx, q1, extra1)
	if err != nil {
		t.Fatalf("unexpected error on turn 1: %v", err)
	}

	if !strings.Contains(ans1.Answer, "Elena") {
		t.Errorf("expected personalization with Elena, got: %s", ans1.Answer)
	}
	if strings.Contains(ans1.Answer, "Ing.") {
		t.Errorf("expected academic title to be stripped, got: %s", ans1.Answer)
	}
	if !strings.Contains(ans1.Answer, "Hola") {
		t.Errorf("expected initial greeting on first turn, got: %s", ans1.Answer)
	}

	// 2. Segundo turno con historial de conversación: NO debe repetir saludos
	q2 := copilot.Question{
		ContextType: copilot.ContextMeter,
		ContextID:   "M-109",
		Question:    "¿Por qué aumentó tanto el consumo en palabras sencillas?",
	}
	extra2 := map[string]interface{}{
		"user_name":       "Ing. Elena Morales",
		"user_first_name": "Elena",
		"meter_id":        "M-109",
		"conversation_history": []interface{}{
			map[string]interface{}{"sender": "user", "text": q1.Question},
			map[string]interface{}{"sender": "assistant", "text": ans1.Answer},
		},
	}

	ans2, err := c.ExplainQuery(ctx, q2, extra2)
	if err != nil {
		t.Fatalf("unexpected error on turn 2: %v", err)
	}

	if strings.Contains(ans2.Answer, "Hola") || strings.Contains(ans2.Answer, "Buenos días") {
		t.Errorf("turn 2 with history should NOT repeat greeting, got: %s", ans2.Answer)
	}
	if !strings.Contains(ans2.Answer, "Elena") {
		t.Errorf("expected personalization with Elena on follow-up turn, got: %s", ans2.Answer)
	}

	// 3. Tercer turno: Pregunta sobre riesgos
	q3 := copilot.Question{
		ContextType: copilot.ContextMeter,
		ContextID:   "M-109",
		Question:    "¿Qué riesgo hay para mis equipos si no reviso esto hoy?",
	}
	extra3 := map[string]interface{}{
		"user_name":       "Ing. Elena Morales",
		"user_first_name": "Elena",
		"meter_id":        "M-109",
		"conversation_history": []interface{}{
			map[string]interface{}{"sender": "user", "text": q1.Question},
			map[string]interface{}{"sender": "assistant", "text": ans1.Answer},
			map[string]interface{}{"sender": "user", "text": q2.Question},
			map[string]interface{}{"sender": "assistant", "text": ans2.Answer},
		},
	}

	ans3, err := c.ExplainQuery(ctx, q3, extra3)
	if err != nil {
		t.Fatalf("unexpected error on turn 3: %v", err)
	}

	if strings.Contains(ans3.Answer, "Hola") {
		t.Errorf("turn 3 should NOT repeat greeting, got: %s", ans3.Answer)
	}
	if !strings.Contains(ans3.Answer, "Joule") || !strings.Contains(ans3.Answer, "aislamiento") {
		t.Errorf("expected technical explanation of thermal degradation and Joule effect, got: %s", ans3.Answer)
	}

	// 4. Cuarto turno: Agradecimiento y cierre ("muchas gracias")
	q4 := copilot.Question{
		ContextType: copilot.ContextGeneral,
		ContextID:   "global",
		Question:    "Muchas gracias por la explicación",
	}
	extra4 := map[string]interface{}{
		"user_name":            "Ing. Elena Morales",
		"user_first_name":      "Elena",
		"conversation_history": []interface{}{map[string]interface{}{"sender": "user", "text": "prev"}},
	}

	ans4, err := c.ExplainQuery(ctx, q4, extra4)
	if err != nil {
		t.Fatalf("unexpected error on turn 4: %v", err)
	}
	if !strings.Contains(ans4.Answer, "Con el mayor gusto, Elena") {
		t.Errorf("expected warm polite closing without greeting repetition, got: %s", ans4.Answer)
	}
	if strings.Contains(ans4.Answer, "Hola") {
		t.Errorf("closing response should NOT contain greeting, got: %s", ans4.Answer)
	}
}

func TestCopilotDeterministic_EnergyExpertAnalogies(t *testing.T) {
	c := ai.NewCopilotDeterministic()
	ctx := context.Background()

	tests := []struct {
		name          string
		question      copilot.Question
		extra         map[string]interface{}
		mustContain   []string
		mustNotContain []string
	}{
		{
			name: "M-109 overcurrent and water hose / beer foam analogy",
			question: copilot.Question{
				ContextType: copilot.ContextMeter,
				ContextID:   "M-109",
				Question:    "Explícame qué está pasando técnicamente con M-109",
			},
			extra: map[string]interface{}{
				"user_name":       "Lic. Andrés Gómez",
				"user_first_name": "Andrés",
				"meter_id":        "M-109",
			},
			mustContain: []string{
				"Andrés",
				"424 Amperios",
				"Joule",
				"manguera",
				"cerveza",
				"espuma",
				"0.74",
			},
			mustNotContain: []string{"Lic."},
		},
		{
			name: "M-112 sensor noise and speedometer analogy without billing increase",
			question: copilot.Question{
				ContextType: copilot.ContextMeter,
				ContextID:   "M-112",
				Question:    "¿Qué significa la anomalía de M-112 y me va a subir la factura?",
			},
			extra: map[string]interface{}{
				"user_name":       "Dr. Carlos Ruiz",
				"user_first_name": "Carlos",
				"meter_id":        "M-112",
			},
			mustContain: []string{
				"Carlos",
				"no habrá sobrecosto",
				"velocímetro",
				"Modbus",
			},
			mustNotContain: []string{"Dr."},
		},
		{
			name: "M-104 production line bakery oven analogy",
			question: copilot.Question{
				ContextType: copilot.ContextMeter,
				ContextID:   "M-104",
				Question:    "¿Por qué aumentó el consumo de M-104?",
			},
			extra: map[string]interface{}{
				"user_name":       "Elena",
				"user_first_name": "Elena",
				"meter_id":        "M-104",
			},
			mustContain: []string{
				"Elena",
				"horno en una panadería",
				"nueva línea de producción",
			},
		},
		{
			name: "M-106 scheduled maintenance car oil change analogy",
			question: copilot.Question{
				ContextType: copilot.ContextMeter,
				ContextID:   "M-106",
				Question:    "¿Por qué cayó a cero el consumo de M-106?",
			},
			extra: map[string]interface{}{
				"user_name":       "Elena",
				"user_first_name": "Elena",
				"meter_id":        "M-106",
			},
			mustContain: []string{
				"Elena",
				"cambio de aceite",
				"caldera",
			},
		},
		{
			name: "M-112 do NOT shut down machines",
			question: copilot.Question{
				ContextType: copilot.ContextMeter,
				ContextID:   "M-112",
				Question:    "¿Debo apagar las máquinas de inyección?",
			},
			extra: map[string]interface{}{
				"user_name":       "Elena",
				"user_first_name": "Elena",
				"meter_id":        "M-112",
			},
			mustContain: []string{
				"No necesitas apagar ninguna máquina",
				"velocímetro",
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ans, err := c.ExplainQuery(ctx, tc.question, tc.extra)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			for _, term := range tc.mustContain {
				if !strings.Contains(ans.Answer, term) {
					t.Errorf("expected answer to contain '%s', answer: %s", term, ans.Answer)
				}
			}
			for _, notTerm := range tc.mustNotContain {
				if strings.Contains(ans.Answer, notTerm) {
					t.Errorf("expected answer NOT to contain '%s', answer: %s", notTerm, ans.Answer)
				}
			}
		})
	}
}
