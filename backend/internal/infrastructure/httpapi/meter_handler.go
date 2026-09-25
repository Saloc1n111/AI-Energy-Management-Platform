package httpapi

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	appmeters "energyhub/internal/app/meters"
	"energyhub/internal/domain/meter"
	"energyhub/internal/domain/reading"
)

// El handler depende de una interfaz (DIP): se puede testear con un mock.
type meterUseCases interface {
	List(ctx context.Context, f meter.Filter) ([]meter.Meter, error)
	Get(ctx context.Context, meterID string) (*appmeters.Detail, error)
	Readings(ctx context.Context, meterID string, rg reading.Range) ([]appmeters.Point, error)
}

type MeterHandler struct{ uc meterUseCases }

func NewMeterHandler(uc meterUseCases) *MeterHandler { return &MeterHandler{uc: uc} }

// GET /api/v1/meters?status=ALERT&q=10&sort=variation&order=desc
func (h *MeterHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := meter.Filter{
		Status: meter.Status(strings.ToUpper(q.Get("status"))),
		Search: q.Get("q"),
		SortBy: meter.SortField(strings.ToLower(q.Get("sort"))),
		Desc:   strings.EqualFold(q.Get("order"), "desc"),
	}
	if f.Status != "" && !f.Status.Valid() {
		writeBadRequest(w, "status inválido: use OK, ALERT o CRITICAL")
		return
	}
	if f.SortBy != "" && !f.SortBy.Valid() {
		writeBadRequest(w, "sort inválido: use meter_id, consumption, variation o severity")
		return
	}
	items, err := h.uc.List(r.Context(), f)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]meterDTO, 0, len(items))
	for _, m := range items {
		out = append(out, toMeterDTO(m))
	}
	writeJSON(w, http.StatusOK, list(out))
}

// GET /api/v1/meters/{meterId}
func (h *MeterHandler) Get(w http.ResponseWriter, r *http.Request) {
	d, err := h.uc.Get(r.Context(), chi.URLParam(r, "meterId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toMeterDetailDTO(*d))
}

// GET /api/v1/meters/{meterId}/readings?from=2026-09-10&to=2026-09-14
func (h *MeterHandler) Readings(w http.ResponseWriter, r *http.Request) {
	var rg reading.Range
	for key, dst := range map[string]**time.Time{"from": &rg.From, "to": &rg.To} {
		v := r.URL.Query().Get(key)
		if v == "" {
			continue
		}
		t, err := parseDate(v, key == "to")
		if err != nil {
			writeBadRequest(w, key+" inválido: use YYYY-MM-DD o RFC3339")
			return
		}
		*dst = &t
	}
	items, err := h.uc.Readings(r.Context(), chi.URLParam(r, "meterId"), rg)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]readingDTO, 0, len(items))
	for _, p := range items {
		out = append(out, toReadingDTO(p))
	}
	writeJSON(w, http.StatusOK, list(out))
}

// parseDate acepta RFC3339 o YYYY-MM-DD; un "to" de solo fecha incluye el día completo.
func parseDate(v string, endOfDay bool) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, v); err == nil {
		return t.UTC(), nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return t, err
	}
	if endOfDay {
		t = t.Add(24*time.Hour - time.Second)
	}
	return t, nil
}
