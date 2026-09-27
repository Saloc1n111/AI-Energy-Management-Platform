package httpapi_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
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

const (
	challengerServerSecret = "challenger_verified_production_grade_secret_key_2026"
	challengerAllowedOrigin = "http://localhost:5173"
	oldDeprecatedFallbackSecret = "bia_energy_hub_default_secret_key_2026"
)

// buildAdversarialServer initializes a full real server wired with genuine sqlite and csv seeder
func buildAdversarialServer(t *testing.T) *httptest.Server {
	t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "challenge_test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := sqlite.Migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := seed.NewCSVSeeder(db, "../../../data", log).Run(context.Background()); err != nil {
		t.Skipf("dataset seeder not available: %v", err)
	}

	mr, rr, er := sqlite.NewMeterRepository(db), sqlite.NewReadingRepository(db), sqlite.NewEventRepository(db)
	ar, runs := sqlite.NewAnomalyRepository(db), sqlite.NewAnalysisRepository(db)
	vr := sqlite.NewVisitRepository(db)
	detCfg := detection.DefaultConfig()

	analysisSvc := appanalysis.NewService(appanalysis.Deps{
		Meters: mr, Readings: rr, Events: er, Anomalies: ar, Runs: runs,
		Explainer: ai.NewDeterministic(), Config: detCfg, Logger: log,
		NewID: func() string { return "run_challenger_1" },
	})
	copilotSvc := appcopilot.NewService(nil, ai.NewCopilotDeterministic(), 5*time.Second, log)
	visitsSvc := appvisits.NewService(vr)
	authSvc := appauth.NewService(challengerServerSecret)

	router := httpapi.NewRouter(httpapi.Handlers{
		Meters:    httpapi.NewMeterHandler(meters.NewService(mr, rr, detCfg)),
		Anomalies: httpapi.NewAnomalyHandler(anomalies.NewService(ar, mr)),
		Analysis:  httpapi.NewAnalysisHandler(analysisSvc),
		Dashboard: httpapi.NewDashboardHandler(dashboard.NewService(mr, rr, ar, runs)),
		Copilot:   httpapi.NewCopilotHandler(copilotSvc, visitsSvc),
		Auth:      httpapi.NewAuthHandler(authSvc),
	}, challengerAllowedOrigin)

	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return srv
}

// craftCustomJWT helper to build custom or intentionally broken JWT tokens
func craftCustomJWT(headerJSON, payloadJSON []byte, secret string) string {
	hB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	pB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)
	unsigned := hB64 + "." + pB64
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(unsigned))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return unsigned + "." + sigB64
}

// All registered business routes that must be guarded by AuthMiddleware
var allBusinessRoutes = []struct {
	method string
	path   string
	body   string
}{
	{http.MethodGet, "/api/v1/auth/me", ""},
	{http.MethodGet, "/api/v1/dashboard/summary", ""},
	{http.MethodGet, "/api/v1/meters", ""},
	{http.MethodGet, "/api/v1/meters/M-109", ""},
	{http.MethodGet, "/api/v1/meters/M-109/readings", ""},
	{http.MethodGet, "/api/v1/anomalies", ""},
	{http.MethodGet, "/api/v1/anomalies/anm_m109_20260912T1400", ""},
	{http.MethodPatch, "/api/v1/anomalies/anm_m109_20260912T1400", `{"status":"RESOLVED"}`},
	{http.MethodPost, "/api/v1/ai/analyze", ""},
	{http.MethodGet, "/api/v1/ai/analysis/run_challenger_1", ""},
	{http.MethodPost, "/api/v1/ai/reset", ""},
	{http.MethodPost, "/api/v1/ai/ask", `{"context_type":"meter","context_id":"M-109","question":"test"}`},
	{http.MethodPost, "/api/v1/technical-visits", `{"meter_id":"M-109"}`},
	{http.MethodGet, "/api/v1/technical-visits", ""},
}

// TestChallenge_OldFallbackKey_RejectedAcrossAllRoutes verifies that tokens signed with the old
// hardcoded default secret key ('bia_energy_hub_default_secret_key_2026') are rejected with 401
// across ALL business routes.
func TestChallenge_OldFallbackKey_RejectedAcrossAllRoutes(t *testing.T) {
	srv := buildAdversarialServer(t)

	// Generate a token signed with the old fallback secret
	header := []byte(`{"alg":"HS256","typ":"JWT"}`)
	payload := []byte(fmt.Sprintf(`{"sub":"usr_elena_morales","username":"elena.morales","exp":%d,"iat":%d}`,
		time.Now().Add(1*time.Hour).Unix(), time.Now().Unix()))
	forgedWithOldKey := craftCustomJWT(header, payload, oldDeprecatedFallbackSecret)

	for _, ep := range allBusinessRoutes {
		t.Run("OldKey_"+ep.method+"_"+ep.path, func(t *testing.T) {
			req, err := http.NewRequest(ep.method, srv.URL+ep.path, strings.NewReader(ep.body))
			if err != nil {
				t.Fatalf("failed to build request: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+forgedWithOldKey)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s %s: expected 401 Unauthorized for token signed with old fallback key, got %d",
					ep.method, ep.path, resp.StatusCode)
			}

			var body map[string]string
			if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
				t.Errorf("expected JSON body on 401: %v", err)
			}
			if body["code"] != "UNAUTHORIZED" {
				t.Errorf("expected code UNAUTHORIZED, got %q", body["code"])
			}
		})
	}
}

// TestChallenge_ForgedTokens_AttackerKeysAndAlgNone verifies arbitrary attacker keys and alg:none
// are rejected with 401 across business routes.
func TestChallenge_ForgedTokens_AttackerKeysAndAlgNone(t *testing.T) {
	srv := buildAdversarialServer(t)

	forgedScenarios := []struct {
		name        string
		tokenString string
	}{
		{
			name: "Arbitrary Attacker Secret Key",
			tokenString: craftCustomJWT(
				[]byte(`{"alg":"HS256","typ":"JWT"}`),
				[]byte(fmt.Sprintf(`{"sub":"usr_attacker","username":"attacker","exp":%d}`, time.Now().Add(time.Hour).Unix())),
				"completely_arbitrary_attacker_secret_999",
			),
		},
		{
			name: "Empty Secret Key Signature",
			tokenString: craftCustomJWT(
				[]byte(`{"alg":"HS256","typ":"JWT"}`),
				[]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","username":"elena.morales","exp":%d}`, time.Now().Add(time.Hour).Unix())),
				"",
			),
		},
		{
			name: "Algorithm None with empty signature",
			tokenString: base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`)) + "." +
				base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","exp":%d}`, time.Now().Add(time.Hour).Unix()))) + ".",
		},
		{
			name: "Algorithm None with fake signature",
			tokenString: base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`)) + "." +
				base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","exp":%d}`, time.Now().Add(time.Hour).Unix()))) + ".fakesig",
		},
		{
			name: "Tampered Payload with Valid Header & Original Signature",
			tokenString: func() string {
				valid := craftCustomJWT(
					[]byte(`{"alg":"HS256","typ":"JWT"}`),
					[]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","role":"analyst","exp":%d}`, time.Now().Add(time.Hour).Unix())),
					challengerServerSecret,
				)
				parts := strings.Split(valid, ".")
				tamperedPayload := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","role":"superadmin","exp":%d}`, time.Now().Add(time.Hour).Unix())))
				return parts[0] + "." + tamperedPayload + "." + parts[2]
			}(),
		},
		{
			name: "Truncated Signature",
			tokenString: func() string {
				valid := craftCustomJWT(
					[]byte(`{"alg":"HS256","typ":"JWT"}`),
					[]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","exp":%d}`, time.Now().Add(time.Hour).Unix())),
					challengerServerSecret,
				)
				return valid[:len(valid)-10]
			}(),
		},
	}

	for _, sc := range forgedScenarios {
		t.Run(sc.name, func(t *testing.T) {
			for _, ep := range allBusinessRoutes {
				req, _ := http.NewRequest(ep.method, srv.URL+ep.path, strings.NewReader(ep.body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+sc.tokenString)

				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatalf("request failed: %v", err)
				}
				resp.Body.Close()

				if resp.StatusCode != http.StatusUnauthorized {
					t.Errorf("[%s] %s %s: expected 401 Unauthorized, got %d", sc.name, ep.method, ep.path, resp.StatusCode)
				}
			}
		})
	}
}

// TestChallenge_ExpiredTokens_RejectedAcrossAllRoutes verifies expired tokens return 401
func TestChallenge_ExpiredTokens_RejectedAcrossAllRoutes(t *testing.T) {
	srv := buildAdversarialServer(t)

	expiredTimes := []struct {
		name string
		exp  int64
	}{
		{"Expired 1 second ago", time.Now().Add(-1 * time.Second).Unix()},
		{"Expired 1 hour ago", time.Now().Add(-1 * time.Hour).Unix()},
		{"Expired 30 days ago", time.Now().Add(-30 * 24 * time.Hour).Unix()},
		{"Zero Expiration (1970)", 0},
	}

	for _, et := range expiredTimes {
		t.Run(et.name, func(t *testing.T) {
			token := craftCustomJWT(
				[]byte(`{"alg":"HS256","typ":"JWT"}`),
				[]byte(fmt.Sprintf(`{"sub":"usr_elena_morales","username":"elena.morales","exp":%d,"iat":%d}`, et.exp, et.exp-3600)),
				challengerServerSecret,
			)

			for _, ep := range allBusinessRoutes {
				req, _ := http.NewRequest(ep.method, srv.URL+ep.path, strings.NewReader(ep.body))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+token)

				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatalf("request failed: %v", err)
				}
				resp.Body.Close()

				if resp.StatusCode != http.StatusUnauthorized {
					t.Errorf("[%s] %s %s: expected 401 Unauthorized for expired token, got %d",
						et.name, ep.method, ep.path, resp.StatusCode)
				}
			}
		})
	}
}

// TestChallenge_MalformedAndEmptyHeaders_Returns401 verifies malformed Authorization headers return 401
func TestChallenge_MalformedAndEmptyHeaders_Returns401(t *testing.T) {
	srv := buildAdversarialServer(t)

	malformedHeaders := []struct {
		name   string
		header string
	}{
		{"No Header", ""},
		{"Whitespace Only", "     "},
		{"Single word Bearer", "Bearer"},
		{"Bearer trailing space", "Bearer "},
		{"Bearer multiple spaces", "Bearer    "},
		{"Basic Auth Scheme", "Basic dXNlcjpwYXNz"},
		{"Token Auth Scheme", "Token 1234567890abcdef"},
		{"Garbage Printable ASCII", "Bearer ~!@#$%^&*()_+-=`{}|[]\\:\";'<>?,./"},
		{"Non-ASCII Unicode", "Bearer ⚡🚀🔥💥💯"},
		{"Two-part Dot String", "Bearer abc.def"},
		{"Four-part Dot String", "Bearer a.b.c.d"},
		{"Single Dot", "Bearer a.b"},
		{"Empty Parts", "Bearer .."},
		{"Malformed Base64 in Header", "Bearer invalid!b64.eyJzdWIiOiIxMjMifQ.c2ln"},
		{"Malformed Base64 in Payload", "Bearer eyJhbGciOiJIUzI1NiJ9.invalid!b64.c2ln"},
		{"Malformed Base64 in Signature", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.invalid!b64"},
		{"Valid Base64 Non-JSON Payload", "Bearer eyJhbGciOiJIUzI1NiJ9.bm90X2pzb25fc3RyaW5n.c2ln"},
		{"Giant Overflow Header", "Bearer " + strings.Repeat("A", 16384)},
	}

	for _, mh := range malformedHeaders {
		t.Run(mh.name, func(t *testing.T) {
			for _, ep := range allBusinessRoutes {
				req, _ := http.NewRequest(ep.method, srv.URL+ep.path, strings.NewReader(ep.body))
				req.Header.Set("Content-Type", "application/json")
				if mh.header != "" {
					req.Header.Set("Authorization", mh.header)
				}

				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatalf("request failed: %v", err)
				}
				resp.Body.Close()

				if resp.StatusCode != http.StatusUnauthorized {
					t.Errorf("[%s] %s %s: expected 401 Unauthorized, got %d",
						mh.name, ep.method, ep.path, resp.StatusCode)
				}
			}
		})
	}
}

// TestChallenge_CORS_UnauthorizedOrigins_NoReflection verifies that unauthorized origins
// never receive an Access-Control-Allow-Origin header and preflights return 403 Forbidden.
func TestChallenge_CORS_UnauthorizedOrigins_NoReflection(t *testing.T) {
	srv := buildAdversarialServer(t)

	unauthorizedOrigins := []string{
		"http://attacker.com",
		"null",
		"http://localhost:9999",
		"https://energyhub.com.evil.org",
		"http://localhost:5173.evil.org",
		"https://localhost:5173",          // Scheme mismatch (HTTPS vs HTTP)
		"http://localhost:5173:8080",      // Port mismatch
		"http://evil-attacker.site",
		"http://attacker.com?param=http://localhost:5173",
	}

	testEndpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/health"},
		{http.MethodGet, "/api/v1/meters"},
		{http.MethodPost, "/api/v1/auth/login"},
	}

	for _, origin := range unauthorizedOrigins {
		t.Run("Origin_"+origin, func(t *testing.T) {
			// 1. Regular HTTP requests (GET / POST)
			for _, ep := range testEndpoints {
				req, _ := http.NewRequest(ep.method, srv.URL+ep.path, nil)
				req.Header.Set("Origin", origin)
				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					t.Fatalf("request failed: %v", err)
				}
				resp.Body.Close()

				acao := resp.Header.Get("Access-Control-Allow-Origin")
				if acao != "" {
					t.Errorf("unauthorized origin %q received Access-Control-Allow-Origin: %q on %s %s (MUST BE OMITTED)",
						origin, acao, ep.method, ep.path)
				}
			}

			// 2. Preflight OPTIONS request
			reqOptions, _ := http.NewRequest(http.MethodOptions, srv.URL+"/health", nil)
			reqOptions.Header.Set("Origin", origin)
			reqOptions.Header.Set("Access-Control-Request-Method", "GET")
			respOptions, err := http.DefaultClient.Do(reqOptions)
			if err != nil {
				t.Fatalf("preflight request failed: %v", err)
			}
			respOptions.Body.Close()

			if respOptions.StatusCode != http.StatusForbidden {
				t.Errorf("unauthorized preflight from %q: expected status 403 Forbidden, got %d",
					origin, respOptions.StatusCode)
			}
			acaoOptions := respOptions.Header.Get("Access-Control-Allow-Origin")
			if acaoOptions != "" {
				t.Errorf("unauthorized preflight from %q received Access-Control-Allow-Origin: %q (MUST BE OMITTED)",
					origin, acaoOptions)
			}
		})
	}
}

// TestChallenge_CORS_AuthorizedOrigin_ProperHeaders verifies authorized origin receives proper CORS headers
func TestChallenge_CORS_AuthorizedOrigin_ProperHeaders(t *testing.T) {
	srv := buildAdversarialServer(t)

	// 1. Regular GET request
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/health", nil)
	req.Header.Set("Origin", challengerAllowedOrigin)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != challengerAllowedOrigin {
		t.Fatalf("expected Access-Control-Allow-Origin %q, got %q", challengerAllowedOrigin, got)
	}
	if got := resp.Header.Get("Vary"); got != "Origin" {
		t.Errorf("expected Vary: Origin, got %q", got)
	}

	// 2. Preflight OPTIONS request
	reqOptions, _ := http.NewRequest(http.MethodOptions, srv.URL+"/health", nil)
	reqOptions.Header.Set("Origin", challengerAllowedOrigin)
	reqOptions.Header.Set("Access-Control-Request-Method", "GET")
	respOptions, err := http.DefaultClient.Do(reqOptions)
	if err != nil {
		t.Fatal(err)
	}
	respOptions.Body.Close()

	if respOptions.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 No Content on authorized preflight, got %d", respOptions.StatusCode)
	}
	if got := respOptions.Header.Get("Access-Control-Allow-Origin"); got != challengerAllowedOrigin {
		t.Fatalf("expected Access-Control-Allow-Origin %q on preflight, got %q", challengerAllowedOrigin, got)
	}
}

// TestChallenge_RawTCPSocket_Attacks verifies network-level raw TCP byte streams
func TestChallenge_RawTCPSocket_Attacks(t *testing.T) {
	srv := buildAdversarialServer(t)
	addr := srv.Listener.Addr().String()

	t.Run("Raw TCP Missing Token Returns 401", func(t *testing.T) {
		resp := sendRawHTTP(t, addr, "GET /api/v1/meters HTTP/1.1\r\nHost: "+addr+"\r\nConnection: close\r\n\r\n")
		if !strings.HasPrefix(resp, "HTTP/1.1 401") {
			t.Fatalf("expected HTTP/1.1 401, got response:\n%s", resp)
		}
	})

	t.Run("Raw TCP Empty Bearer Returns 401", func(t *testing.T) {
		resp := sendRawHTTP(t, addr, "GET /api/v1/meters HTTP/1.1\r\nHost: "+addr+"\r\nAuthorization: Bearer \r\nConnection: close\r\n\r\n")
		if !strings.HasPrefix(resp, "HTTP/1.1 401") {
			t.Fatalf("expected HTTP/1.1 401, got response:\n%s", resp)
		}
	})

	t.Run("Raw TCP Binary NUL in Auth Header Rejected", func(t *testing.T) {
		raw := "GET /api/v1/meters HTTP/1.1\r\nHost: " + addr + "\r\nAuthorization: Bearer \x00\x01\x02\xff\r\nConnection: close\r\n\r\n"
		resp := sendRawHTTP(t, addr, raw)
		// Go's HTTP parser rejects invalid byte in header with 400 Bad Request
		if !strings.HasPrefix(resp, "HTTP/1.1 400") && !strings.HasPrefix(resp, "HTTP/1.1 401") {
			t.Fatalf("expected HTTP/1.1 400 or 401 for binary NUL header, got response:\n%s", resp)
		}
	})

	t.Run("Raw TCP Unauthorized CORS Preflight Returns 403 Without ACAO", func(t *testing.T) {
		raw := "OPTIONS /health HTTP/1.1\r\nHost: " + addr + "\r\nOrigin: http://evil-hacker.com\r\nAccess-Control-Request-Method: GET\r\nConnection: close\r\n\r\n"
		resp := sendRawHTTP(t, addr, raw)
		if !strings.HasPrefix(resp, "HTTP/1.1 403") {
			t.Fatalf("expected HTTP/1.1 403, got response:\n%s", resp)
		}
		if strings.Contains(strings.ToLower(resp), "access-control-allow-origin") {
			t.Fatalf("response MUST NOT contain Access-Control-Allow-Origin header:\n%s", resp)
		}
	})
}

func sendRawHTTP(t *testing.T, addr, raw string) string {
	t.Helper()
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		t.Fatalf("failed to dial server: %v", err)
	}
	defer conn.Close()

	if _, err := conn.Write([]byte(raw)); err != nil {
		t.Fatalf("failed to write raw HTTP: %v", err)
	}

	buf, err := io.ReadAll(conn)
	if err != nil {
		t.Fatalf("failed to read raw response: %v", err)
	}
	return string(buf)
}
