package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Handlers struct {
	Meters        *MeterHandler
	Anomalies     *AnomalyHandler
	Analysis      *AnalysisHandler
	Dashboard     *DashboardHandler
	Copilot       *CopilotHandler
	Auth          *AuthHandler
	AuthValidator TokenValidator
}

func NewRouter(h Handlers, allowedOrigin string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger,
		middleware.Recoverer, middleware.Timeout(30*time.Second), cors(allowedOrigin))

	// Endpoint público de salud
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	var validator TokenValidator = h.AuthValidator
	if validator == nil && h.Auth != nil {
		validator = h.Auth.authService
	}

	r.Route("/api/v1", func(r chi.Router) {
		// 1. Rutas públicas (sin autenticación)
		if h.Auth != nil {
			r.Post("/auth/login", h.Auth.Login)
		}

		// 2. Rutas de negocio protegidas (autenticación obligatoria JWT)
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(validator))

			if h.Auth != nil {
				r.Get("/auth/me", h.Auth.Me)
			}

			if h.Dashboard != nil {
				r.Get("/dashboard/summary", h.Dashboard.Summary)
			}

			if h.Meters != nil {
				r.Get("/meters", h.Meters.List)
				r.Get("/meters/{meterId}", h.Meters.Get)
				r.Get("/meters/{meterId}/readings", h.Meters.Readings)
			}

			if h.Anomalies != nil {
				r.Get("/anomalies", h.Anomalies.List)
				r.Get("/anomalies/{id}", h.Anomalies.Get)
				r.Patch("/anomalies/{id}", h.Anomalies.UpdateStatus)
			}

			if h.Analysis != nil {
				r.Post("/ai/analyze", h.Analysis.Analyze)
				r.Get("/ai/analysis/{id}", h.Analysis.Get)
				r.Post("/ai/reset", h.Analysis.Reset)
			}

			if h.Copilot != nil {
				r.Post("/ai/ask", h.Copilot.Ask)
				r.Post("/technical-visits", h.Copilot.CreateVisit)
				r.Get("/technical-visits", h.Copilot.ListVisits)
			}
		})
	})
	return r
}
