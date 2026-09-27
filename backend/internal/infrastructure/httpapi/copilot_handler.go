package httpapi

import (
	"encoding/json"
	"net/http"

	appcopilot "energyhub/internal/app/copilot"
	appvisits "energyhub/internal/app/visits"
	"energyhub/internal/domain/copilot"
)

type CopilotHandler struct {
	copilot *appcopilot.Service
	visits  *appvisits.Service
}

func NewCopilotHandler(c *appcopilot.Service, v *appvisits.Service) *CopilotHandler {
	return &CopilotHandler{
		copilot: c,
		visits:  v,
	}
}

type askRequestDTO struct {
	ContextType string                 `json:"context_type"`
	ContextID   string                 `json:"context_id"`
	Question    string                 `json:"question"`
	ContextData map[string]interface{} `json:"context_data"`
}

func (h *CopilotHandler) Ask(w http.ResponseWriter, r *http.Request) {
	var dto askRequestDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeBadRequest(w, "Cuerpo JSON inválido")
		return
	}

	q := copilot.Question{
		ContextType: copilot.ContextType(dto.ContextType),
		ContextID:   dto.ContextID,
		Question:    dto.Question,
		ContextData: dto.ContextData,
	}

	ans, err := h.copilot.Ask(r.Context(), q)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, ans)
}

func (h *CopilotHandler) CreateVisit(w http.ResponseWriter, r *http.Request) {
	var req appvisits.CreateVisitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w, "Cuerpo JSON inválido")
		return
	}

	visit, err := h.visits.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, visit)
}

func (h *CopilotHandler) ListVisits(w http.ResponseWriter, r *http.Request) {
	items, err := h.visits.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, list(items))
}
