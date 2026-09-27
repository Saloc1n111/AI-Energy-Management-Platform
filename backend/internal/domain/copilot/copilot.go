package copilot

// ContextType describe qué elemento o card del dashboard está consultando el usuario.
type ContextType string

const (
	ContextMeter        ContextType = "meter"
	ContextKPI          ContextType = "kpi"
	ContextAnomaly      ContextType = "anomaly"
	ContextDistribution ContextType = "distribution"
	ContextTimeline     ContextType = "timeline"
	ContextGeneral      ContextType = "general"
)

// Question representa una consulta formulada por el usuario al copiloto de IA.
type Question struct {
	ContextType ContextType            `json:"context_type"`
	ContextID   string                 `json:"context_id"`
	Question    string                 `json:"question"`
	ContextData map[string]interface{} `json:"context_data,omitempty"`
}

// Action representa una acción operativa recomendada en lenguaje no técnico.
type Action struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	ActionType  string `json:"action_type"` // "technical_visit", "view_meter", "update_baseline", etc.
	Payload     string `json:"payload,omitempty"`
	Description string `json:"description,omitempty"`
}

// Answer representa la respuesta amigable generada para el cliente de negocio.
type Answer struct {
	Answer            string   `json:"answer"`
	KeyTakeaways      []string `json:"key_takeaways,omitempty"`
	SuggestedActions  []Action `json:"suggested_actions,omitempty"`
	FollowUpQuestions []string `json:"follow_up_questions,omitempty"`
	Source            string   `json:"source"` // "gemini" o "deterministic"
	ContextID         string   `json:"context_id,omitempty"`
}
