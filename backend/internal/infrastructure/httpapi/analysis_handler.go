package httpapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	appdash "energyhub/internal/app/dashboard"
	"energyhub/internal/domain/analysis"
)

type analysisUseCases interface {
	Start(ctx context.Context) (*analysis.Run, error)
	Get(ctx context.Context, id string) (*analysis.Run, error)
	Latest(ctx context.Context) (*analysis.Run, error)
	Reset(ctx context.Context) error
}

type AnalysisHandler struct{ uc analysisUseCases }

func NewAnalysisHandler(uc analysisUseCases) *AnalysisHandler { return &AnalysisHandler{uc: uc} }

// POST /api/v1/ai/analyze → 202 Accepted + Location. El cliente consulta el estado por polling.
func (h *AnalysisHandler) Analyze(w http.ResponseWriter, r *http.Request) {
	run, err := h.uc.Start(r.Context())
	if errors.Is(err, analysis.ErrAlreadyRunning) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error(), "code": "ALREADY_RUNNING", "run_id": run.ID})
		return
	}
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", "/api/v1/ai/analysis/"+run.ID)
	writeJSON(w, http.StatusAccepted, toRunDTO(*run))
}

// GET /api/v1/ai/analysis/{id}  (acepta "latest")
func (h *AnalysisHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var run *analysis.Run
	var err error
	if id == "latest" {
		run, err = h.uc.Latest(r.Context())
	} else {
		run, err = h.uc.Get(r.Context(), id)
	}
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toRunDTO(*run))
}

// POST /api/v1/ai/reset
func (h *AnalysisHandler) Reset(w http.ResponseWriter, r *http.Request) {
	if err := h.uc.Reset(r.Context()); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"message": "Estado de análisis reseteado. Listo para ejecutar Run AI Analysis.",
	})
}

type dashboardUseCases interface {
	Summary(ctx context.Context) (*appdash.Summary, error)
}

type DashboardHandler struct{ uc dashboardUseCases }

func NewDashboardHandler(uc dashboardUseCases) *DashboardHandler { return &DashboardHandler{uc: uc} }

// GET /api/v1/dashboard/summary
func (h *DashboardHandler) Summary(w http.ResponseWriter, r *http.Request) {
	s, err := h.uc.Summary(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toDashboardDTO(*s))
}
