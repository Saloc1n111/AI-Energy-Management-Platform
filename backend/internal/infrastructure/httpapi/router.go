package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Handlers struct {
	Meters    *MeterHandler
	Anomalies *AnomalyHandler
	Analysis  *AnalysisHandler
	Dashboard *DashboardHandler
}

func NewRouter(h Handlers, allowedOrigin string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger,
		middleware.Recoverer, middleware.Timeout(30*time.Second), cors(allowedOrigin))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/dashboard/summary", h.Dashboard.Summary)

		r.Get("/meters", h.Meters.List)
		r.Get("/meters/{meterId}", h.Meters.Get)
		r.Get("/meters/{meterId}/readings", h.Meters.Readings)

		r.Get("/anomalies", h.Anomalies.List)
		r.Get("/anomalies/{id}", h.Anomalies.Get)
		r.Patch("/anomalies/{id}", h.Anomalies.UpdateStatus)

		r.Post("/ai/analyze", h.Analysis.Analyze)
		r.Get("/ai/analysis/{id}", h.Analysis.Get)
	})
	return r
}

func cors(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				origin = allowedOrigin
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
			w.Header().Set("Access-Control-Expose-Headers", "Location, Content-Length")
			w.Header().Set("Access-Control-Max-Age", "86400")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
