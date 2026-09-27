package httpapi_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	appanalysis "energyhub/internal/app/analysis"
	"energyhub/internal/app/anomalies"
	appauth "energyhub/internal/app/auth"
	appcopilot "energyhub/internal/app/copilot"
	"energyhub/internal/app/dashboard"
	"energyhub/internal/app/meters"
	appvisits "energyhub/internal/app/visits"
	"energyhub/internal/domain/detection"
	"energyhub/internal/infrastructure/ai"
	"energyhub/internal/infrastructure/httpapi"
	"energyhub/internal/infrastructure/seed"
	"energyhub/internal/infrastructure/sqlite"
)

const testIntegrationSecret = "test_jwt_secret_integration_2026"

func getTestToken(t *testing.T) string {
	t.Helper()
	authSvc := appauth.NewService(testIntegrationSecret)
	sess, err := authSvc.Authenticate("elena.morales", "Elena#Bia2026")
	if err != nil {
		t.Fatalf("failed to authenticate test user: %v", err)
	}
	return sess.Token
}

// Test end-to-end: SQLite real + CSV reales + API HTTP + pipeline completo (explainer determinista).
func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := sqlite.Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := seed.NewCSVSeeder(db, "../../../data", log).Run(context.Background()); err != nil {
		t.Skipf("dataset no disponible: %v", err)
	}

	mr, rr, er := sqlite.NewMeterRepository(db), sqlite.NewReadingRepository(db), sqlite.NewEventRepository(db)
	ar, runs := sqlite.NewAnomalyRepository(db), sqlite.NewAnalysisRepository(db)
	vr := sqlite.NewVisitRepository(db)
	cfg := detection.DefaultConfig()
	n := 0
	svc := appanalysis.NewService(appanalysis.Deps{
		Meters: mr, Readings: rr, Events: er, Anomalies: ar, Runs: runs,
		Explainer: ai.NewDeterministic(), Config: cfg, Logger: log,
		NewID: func() string { n++; return "run_test_" + string(rune('0'+n)) },
	})
	copilotSvc := appcopilot.NewService(nil, ai.NewCopilotDeterministic(), 5*time.Second, log)
	visitsSvc := appvisits.NewService(vr)
	authSvc := appauth.NewService(testIntegrationSecret)

	srv := httptest.NewServer(httpapi.NewRouter(httpapi.Handlers{
		Meters:    httpapi.NewMeterHandler(meters.NewService(mr, rr, cfg)),
		Anomalies: httpapi.NewAnomalyHandler(anomalies.NewService(ar, mr)),
		Analysis:  httpapi.NewAnalysisHandler(svc),
		Dashboard: httpapi.NewDashboardHandler(dashboard.NewService(mr, rr, ar, runs)),
		Copilot:   httpapi.NewCopilotHandler(copilotSvc, visitsSvc),
		Auth:      httpapi.NewAuthHandler(authSvc),
	}, "http://localhost:5173"))
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, srv *httptest.Server, method, path, body string, out any) int {
	t.Helper()
	return doWithAuth(t, srv, getTestToken(t), method, path, body, out)
}

func doWithAuth(t *testing.T, srv *httptest.Server, token, method, path, body string, out any) int {
	t.Helper()
	req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("%s %s: decode: %v", method, path, err)
		}
	}
	return resp.StatusCode
}

type runResp struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
	Steps   []struct {
		Name, Status, Detail string
	} `json:"steps"`
	Summary struct {
		AnomaliesDetected int `json:"anomalies_detected"`
		HighPriority      int `json:"high_priority"`
	} `json:"summary"`
}

func runAnalysis(t *testing.T, srv *httptest.Server) runResp {
	t.Helper()
	var r runResp
	if code := do(t, srv, http.MethodPost, "/api/v1/ai/analyze", "", &r); code != http.StatusAccepted {
		t.Fatalf("analyze: status %d", code)
	}
	deadline := time.Now().Add(10 * time.Second)
	for r.Status == "RUNNING" && time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
		do(t, srv, http.MethodGet, "/api/v1/ai/analysis/"+r.ID, "", &r)
	}
	if r.Status != "COMPLETED" {
		t.Fatalf("run not completed: %+v", r)
	}
	return r
}

func TestAPI_FullFlow(t *testing.T) {
	srv := newTestServer(t)

	// Antes del análisis no hay anomalías.
	var anoms struct {
		Data []struct {
			ID, MeterID, Type, Severity, Status string
			MeterIDJSON                         string `json:"meter_id"`
			RequiresAttention                   bool   `json:"requires_attention"`
		} `json:"data"`
		Total int `json:"total"`
	}
	do(t, srv, http.MethodGet, "/api/v1/anomalies", "", &anoms)
	if anoms.Total != 0 {
		t.Fatalf("expected 0 anomalies before analysis, got %d", anoms.Total)
	}

	run := runAnalysis(t, srv)
	if run.Summary.AnomaliesDetected != 4 || run.Summary.HighPriority != 2 {
		t.Fatalf("summary: %+v", run.Summary)
	}
	if run.Message != "4 anomalías detectadas · 2 requieren atención prioritaria" {
		t.Fatalf("message: %q", run.Message)
	}
	for _, s := range run.Steps {
		if s.Status != "COMPLETED" {
			t.Errorf("step %s: %s", s.Name, s.Status)
		}
	}

	// Anomalías priorizadas: M-109 primero; M-106 al final y sin escalar.
	do(t, srv, http.MethodGet, "/api/v1/anomalies", "", &anoms)
	order := []string{}
	for _, a := range anoms.Data {
		order = append(order, a.MeterIDJSON+":"+a.Type)
	}
	want := []string{"M-109:REAL_ANOMALY", "M-112:DATA_QUALITY", "M-104:EXPLAINABLE_ANOMALY", "M-106:FALSE_POSITIVE"}
	if strings.Join(order, ",") != strings.Join(want, ",") {
		t.Fatalf("priority order:\n got  %v\n want %v", order, want)
	}

	// Estado de medidores derivado del análisis.
	var ms struct {
		Data []struct {
			MeterID string `json:"meter_id"`
			Status  string `json:"status"`
			Metrics *struct {
				VariationPct float64 `json:"variation_pct"`
			} `json:"metrics"`
		} `json:"data"`
	}
	do(t, srv, http.MethodGet, "/api/v1/meters?sort=severity&order=desc", "", &ms)
	status := map[string]string{}
	for _, m := range ms.Data {
		status[m.MeterID] = m.Status
		if m.Metrics == nil {
			t.Errorf("%s without metrics", m.MeterID)
		}
	}
	for id, st := range map[string]string{"M-109": "CRITICAL", "M-112": "ALERT", "M-104": "ALERT", "M-106": "OK", "M-101": "OK"} {
		if status[id] != st {
			t.Errorf("%s status %s, want %s", id, status[id], st)
		}
	}
	if ms.Data[0].MeterID != "M-109" {
		t.Errorf("sort by severity: first is %s", ms.Data[0].MeterID)
	}

	// Detalle de anomalía con evidencia y factores de confianza.
	var det struct {
		Evidence          []any  `json:"evidence"`
		ConfidenceFactors []any  `json:"confidence_factors"`
		Reason            string `json:"reason"`
		RelatedEvent      *struct {
			Type string `json:"type"`
		} `json:"related_event"`
	}
	if code := do(t, srv, http.MethodGet, "/api/v1/anomalies/anm_m109_20260912T1400", "", &det); code != 200 {
		t.Fatalf("anomaly detail status %d", code)
	}
	if len(det.Evidence) < 5 || len(det.ConfidenceFactors) < 3 || det.Reason == "" || det.RelatedEvent == nil || det.RelatedEvent.Type != "UNKNOWN" {
		t.Fatalf("detail incomplete: %+v", det)
	}

	// Acción: resolver M-109 pasa el medidor a OK.
	if code := do(t, srv, http.MethodPatch, "/api/v1/anomalies/anm_m109_20260912T1400", `{"status":"RESOLVED"}`, nil); code != 200 {
		t.Fatalf("patch status %d", code)
	}
	var m109 struct{ Status string }
	do(t, srv, http.MethodGet, "/api/v1/meters/M-109", "", &m109)
	if m109.Status != "OK" {
		t.Fatalf("M-109 after resolve: %s", m109.Status)
	}

	// Re-ejecutar el análisis respeta el estado RESOLVED (IDs estables).
	runAnalysis(t, srv)
	do(t, srv, http.MethodGet, "/api/v1/meters/M-109", "", &m109)
	if m109.Status != "OK" {
		t.Fatalf("re-analysis must not reopen a resolved anomaly, M-109 is %s", m109.Status)
	}

	// Dashboard
	var dash struct {
		TotalMeters  int     `json:"total_meters"`
		HighPriority int     `json:"high_priority"`
		TotalKWh     float64 `json:"total_consumption_kwh"`
		LastAnalysis *struct {
			Status string `json:"status"`
		} `json:"last_analysis"`
	}
	do(t, srv, http.MethodGet, "/api/v1/dashboard/summary", "", &dash)
	if dash.TotalMeters != 12 || dash.TotalKWh < 100000 || dash.LastAnalysis == nil || dash.HighPriority != 1 {
		t.Fatalf("dashboard: %+v", dash)
	}
}

func TestAPI_Readings_WithBaseline(t *testing.T) {
	srv := newTestServer(t)
	var rs struct {
		Data []struct {
			Expected float64 `json:"expected_kwh"`
		} `json:"data"`
		Total int `json:"total"`
	}
	do(t, srv, http.MethodGet, "/api/v1/meters/M-109/readings?from=2026-09-12&to=2026-09-12", "", &rs)
	if rs.Total != 24 || rs.Data[0].Expected <= 0 {
		t.Fatalf("readings: total=%d first=%+v", rs.Total, rs.Data)
	}
}

func TestAPI_Errors(t *testing.T) {
	srv := newTestServer(t)
	for path, want := range map[string]int{
		"/api/v1/meters/M-999":                   404,
		"/api/v1/meters?status=XYZ":              400,
		"/api/v1/meters?sort=hack":               400,
		"/api/v1/anomalies?severity=XYZ":         400,
		"/api/v1/anomalies/nope":                 404,
		"/api/v1/ai/analysis/nope":               404,
		"/api/v1/ai/analysis/latest":             404,
		"/api/v1/meters/M-109/readings?from=bad": 400,
	} {
		if got := do(t, srv, http.MethodGet, path, "", nil); got != want {
			t.Errorf("%s: got %d, want %d", path, got, want)
		}
	}
}

func TestAPI_CopilotAsk(t *testing.T) {
	srv := newTestServer(t)
	var ans struct {
		Answer            string   `json:"answer"`
		KeyTakeaways      []string `json:"key_takeaways"`
		FollowUpQuestions []string `json:"follow_up_questions"`
	}
	body := `{"context_type":"meter","context_id":"M-109","question":"¿Por qué aumentó tanto el consumo?"}`
	code := do(t, srv, http.MethodPost, "/api/v1/ai/ask", body, &ans)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}
	if len(ans.KeyTakeaways) == 0 || ans.Answer == "" {
		t.Fatalf("expected valid copilot response, got %+v", ans)
	}
}

func TestAPI_TechnicalVisits(t *testing.T) {
	srv := newTestServer(t)
	var visit struct {
		ID      string `json:"id"`
		MeterID string `json:"meter_id"`
		Status  string `json:"status"`
	}
	reqBody := `{"meter_id":"M-109","urgency":"IMMEDIATE","reason":"Aumento inusual de consumo","contact_name":"Juan Perez","contact_phone":"+573001112233","notes":"Urgente"}`
	code := do(t, srv, http.MethodPost, "/api/v1/technical-visits", reqBody, &visit)
	if code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", code)
	}
	if visit.ID == "" || visit.MeterID != "M-109" || visit.Status != "CONFIRMED" {
		t.Fatalf("expected confirmed visit, got %+v", visit)
	}

	var list struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	code = do(t, srv, http.MethodGet, "/api/v1/technical-visits", "", &list)
	if code != http.StatusOK || list.Total != 1 {
		t.Fatalf("expected 1 visit in list, got total=%d", list.Total)
	}
}

func TestAPI_ResetAnalysis(t *testing.T) {
	srv := newTestServer(t)
	runAnalysis(t, srv)

	var anoms struct {
		Total int `json:"total"`
	}
	do(t, srv, http.MethodGet, "/api/v1/anomalies", "", &anoms)
	if anoms.Total == 0 {
		t.Fatalf("expected anomalies after run, got %d", anoms.Total)
	}

	var resetResp map[string]string
	code := do(t, srv, http.MethodPost, "/api/v1/ai/reset", "", &resetResp)
	if code != http.StatusOK {
		t.Fatalf("expected 200 on reset, got %d", code)
	}

	do(t, srv, http.MethodGet, "/api/v1/anomalies", "", &anoms)
	if anoms.Total != 0 {
		t.Fatalf("expected 0 anomalies after reset, got %d", anoms.Total)
	}
}

func TestAPI_Security_ProtectedRoutesReturn401(t *testing.T) {
	srv := newTestServer(t)
	protectedEndpoints := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/v1/dashboard/summary", ""},
		{http.MethodGet, "/api/v1/meters", ""},
		{http.MethodGet, "/api/v1/meters/M-109", ""},
		{http.MethodGet, "/api/v1/meters/M-109/readings", ""},
		{http.MethodGet, "/api/v1/anomalies", ""},
		{http.MethodGet, "/api/v1/anomalies/anm_m109_20260912T1400", ""},
		{http.MethodPatch, "/api/v1/anomalies/anm_m109_20260912T1400", `{"status":"RESOLVED"}`},
		{http.MethodPost, "/api/v1/ai/analyze", ""},
		{http.MethodGet, "/api/v1/ai/analysis/run_test_1", ""},
		{http.MethodPost, "/api/v1/ai/reset", ""},
		{http.MethodPost, "/api/v1/ai/ask", `{"context_type":"meter","context_id":"M-109","question":"test"}`},
		{http.MethodPost, "/api/v1/technical-visits", `{"meter_id":"M-109"}`},
		{http.MethodGet, "/api/v1/technical-visits", ""},
		{http.MethodGet, "/api/v1/auth/me", ""},
	}

	for _, ep := range protectedEndpoints {
		t.Run("SinToken_"+ep.method+"_"+ep.path, func(t *testing.T) {
			code := doWithAuth(t, srv, "", ep.method, ep.path, ep.body, nil)
			if code != http.StatusUnauthorized {
				t.Errorf("%s %s sin token: got %d, want 401", ep.method, ep.path, code)
			}
		})

		t.Run("TokenInvalido_"+ep.method+"_"+ep.path, func(t *testing.T) {
			code := doWithAuth(t, srv, "token.invalido.malformado", ep.method, ep.path, ep.body, nil)
			if code != http.StatusUnauthorized {
				t.Errorf("%s %s con token inválido: got %d, want 401", ep.method, ep.path, code)
			}
		})
	}
}

func TestAPI_Security_PublicRoutes(t *testing.T) {
	srv := newTestServer(t)

	// /health debe ser accesible sin autenticación
	code := doWithAuth(t, srv, "", http.MethodGet, "/health", "", nil)
	if code != http.StatusOK {
		t.Errorf("/health sin token: got %d, want 200", code)
	}

	// /api/v1/auth/login debe ser accesible sin autenticación
	loginBody := `{"username":"elena.morales","password":"Elena#Bia2026"}`
	var loginResp struct {
		Token string `json:"token"`
	}
	code = doWithAuth(t, srv, "", http.MethodPost, "/api/v1/auth/login", loginBody, &loginResp)
	if code != http.StatusOK {
		t.Errorf("/api/v1/auth/login sin token: got %d, want 200", code)
	}
	if loginResp.Token == "" {
		t.Error("expected non-empty token from public login")
	}
}

func TestAPI_Security_CORSOriginPolicy(t *testing.T) {
	srv := newTestServer(t)

	// 1. Origen permitido configurado ("http://localhost:5173")
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("origen permitido: got Access-Control-Allow-Origin %q, want %q", got, "http://localhost:5173")
	}

	// 2. Origen no autorizado ("http://malicious-attacker.com")
	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/health", nil)
	req.Header.Set("Origin", "http://malicious-attacker.com")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("origen no autorizado NO debe recibir Access-Control-Allow-Origin, got %q", got)
	}

	// 3. Solicitud sin cabecera Origin
	req, _ = http.NewRequest(http.MethodGet, srv.URL+"/health", nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("sin cabecera Origin NO debe recibir Access-Control-Allow-Origin, got %q", got)
	}

	// 4. Preflight OPTIONS con origen permitido
	req, _ = http.NewRequest(http.MethodOptions, srv.URL+"/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("preflight permitido: got %d, want 204", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("preflight permitido: got %q, want %q", got, "http://localhost:5173")
	}

	// 5. Preflight OPTIONS con origen no autorizado -> 403 Forbidden
	req, _ = http.NewRequest(http.MethodOptions, srv.URL+"/health", nil)
	req.Header.Set("Origin", "http://malicious-attacker.com")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("preflight no autorizado: got %d, want 403", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("preflight no autorizado: NO debe tener Access-Control-Allow-Origin, got %q", got)
	}
}


