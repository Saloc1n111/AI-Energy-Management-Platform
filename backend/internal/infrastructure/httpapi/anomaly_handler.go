package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"energyhub/internal/domain/anomaly"
)

type anomalyUseCases interface {
	List(ctx context.Context, f anomaly.Filter) ([]anomaly.Anomaly, error)
	Get(ctx context.Context, id string) (*anomaly.Anomaly, error)
	ChangeStatus(ctx context.Context, id string, to anomaly.Status) (*anomaly.Anomaly, error)
}

type AnomalyHandler struct{ uc anomalyUseCases }

func NewAnomalyHandler(uc anomalyUseCases) *AnomalyHandler { return &AnomalyHandler{uc: uc} }

// GET /api/v1/anomalies?meter_id=M-109&severity=HIGH&type=REAL_ANOMALY&status=OPEN
// Devuelve la lista ya priorizada.
func (h *AnomalyHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := anomaly.Filter{
		MeterID:  q.Get("meter_id"),
		Type:     anomaly.Type(strings.ToUpper(q.Get("type"))),
		Severity: anomaly.Severity(strings.ToUpper(q.Get("severity"))),
		Status:   anomaly.Status(strings.ToUpper(q.Get("status"))),
	}
	switch {
	case f.Type != "" && !f.Type.Valid():
		writeBadRequest(w, "type inválido: use REAL_ANOMALY, EXPLAINABLE_ANOMALY, FALSE_POSITIVE o DATA_QUALITY")
		return
	case f.Severity != "" && !f.Severity.Valid():
		writeBadRequest(w, "severity inválido: use LOW, MEDIUM o HIGH")
		return
	case f.Status != "" && !f.Status.Valid():
		writeBadRequest(w, "status inválido: use OPEN, ACKNOWLEDGED o RESOLVED")
		return
	}
	items, err := h.uc.List(r.Context(), f)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]anomalyDTO, 0, len(items))
	for _, a := range items {
		out = append(out, toAnomalyDTO(a))
	}
	writeJSON(w, http.StatusOK, list(out))
}

// GET /api/v1/anomalies/{id}
func (h *AnomalyHandler) Get(w http.ResponseWriter, r *http.Request) {
	a, err := h.uc.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toAnomalyDTO(*a))
}

// PATCH /api/v1/anomalies/{id}  body: {"status":"ACKNOWLEDGED"}
func (h *AnomalyHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<12)).Decode(&body); err != nil {
		writeBadRequest(w, "body JSON inválido")
		return
	}
	to := anomaly.Status(strings.ToUpper(body.Status))
	if !to.Valid() {
		writeBadRequest(w, "status inválido: use OPEN, ACKNOWLEDGED o RESOLVED")
		return
	}
	a, err := h.uc.ChangeStatus(r.Context(), chi.URLParam(r, "id"), to)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toAnomalyDTO(*a))
}
