package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"energyhub/internal/domain/analysis"
	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/meter"
)

type errorBody struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeBadRequest(w http.ResponseWriter, msg string) {
	writeJSON(w, http.StatusBadRequest, errorBody{Error: msg, Code: "BAD_REQUEST"})
}

// writeError traduce errores de dominio a códigos HTTP en un solo lugar.
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, meter.ErrNotFound), errors.Is(err, anomaly.ErrNotFound), errors.Is(err, analysis.ErrNotFound):
		writeJSON(w, http.StatusNotFound, errorBody{Error: err.Error(), Code: "NOT_FOUND"})
	case errors.Is(err, anomaly.ErrInvalidTransition):
		writeJSON(w, http.StatusConflict, errorBody{Error: err.Error(), Code: "INVALID_TRANSITION"})
	default:
		slog.Error("unhandled error", "err", err)
		writeJSON(w, http.StatusInternalServerError, errorBody{Error: "internal server error", Code: "INTERNAL"})
	}
}

func list[T any](items []T) map[string]any {
	if items == nil {
		items = []T{}
	}
	return map[string]any{"data": items, "total": len(items)}
}
