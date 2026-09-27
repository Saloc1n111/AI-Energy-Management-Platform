package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	appauth "energyhub/internal/app/auth"
	"energyhub/internal/infrastructure/httpapi"
	"github.com/go-chi/chi/v5"
)

func TestCORS_Preflight_UnauthorizedOrigins_Return403AndNoAllowHeaders(t *testing.T) {
	allowedOrigin := "http://localhost:5173"
	authSvc := appauth.NewService("test_secret_for_cors_boundary")

	handlers := httpapi.Handlers{
		Auth: httpapi.NewAuthHandler(authSvc),
	}
	router := chi.NewRouter()
	router.Use(httpapi.CORSMiddleware(allowedOrigin))
	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	router.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", handlers.Auth.Login)
		r.Group(func(r chi.Router) {
			r.Use(httpapi.AuthMiddleware(authSvc))
			r.Get("/meters", func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			r.Get("/anomalies", func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
			r.Post("/technical-visits", func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusCreated)
			})
		})
	})

	unauthorizedOrigins := []struct {
		name   string
		origin string
	}{
		{"Attacker Domain", "http://evil-attacker.com"},
		{"Subdomain Suffix Spoofing", "http://localhost:5173.attacker.com"},
		{"Query String Spoofing", "http://attacker.com?origin=http://localhost:5173"},
		{"Scheme Mismatch (HTTPS)", "https://localhost:5173"},
		{"Port Mismatch (3000)", "http://localhost:3000"},
		{"Port Mismatch (8080)", "http://localhost:8080"},
		{"Loopback IP Mismatch", "http://127.0.0.1:5173"},
		{"Null Origin", "null"},
		{"Missing Origin Header", ""},
	}

	endpoints := []string{
		"/health",
		"/api/v1/auth/login",
		"/api/v1/meters",
		"/api/v1/anomalies",
		"/api/v1/technical-visits",
	}

	for _, tc := range unauthorizedOrigins {
		for _, endpoint := range endpoints {
			testName := tc.name + " -> " + endpoint
			t.Run(testName, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodOptions, endpoint, nil)
				if tc.origin != "" {
					req.Header.Set("Origin", tc.origin)
				}
				req.Header.Set("Access-Control-Request-Method", "POST")
				req.Header.Set("Access-Control-Request-Headers", "Content-Type, Authorization")

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				// 1. Status MUST be 403 Forbidden
				if w.Code != http.StatusForbidden {
					t.Fatalf("expected HTTP 403 Forbidden for unauthorized origin %q on %s, got %d", tc.origin, endpoint, w.Code)
				}

				// 2. CORS Allow headers MUST be absent
				if allowOrigin := w.Header().Get("Access-Control-Allow-Origin"); allowOrigin != "" {
					t.Fatalf("Access-Control-Allow-Origin MUST be omitted for unauthorized origin %q, got %q", tc.origin, allowOrigin)
				}
				if allowMethods := w.Header().Get("Access-Control-Allow-Methods"); allowMethods != "" {
					t.Fatalf("Access-Control-Allow-Methods MUST be omitted for unauthorized origin %q, got %q", tc.origin, allowMethods)
				}
				if allowHeaders := w.Header().Get("Access-Control-Allow-Headers"); allowHeaders != "" {
					t.Fatalf("Access-Control-Allow-Headers MUST be omitted for unauthorized origin %q, got %q", tc.origin, allowHeaders)
				}
			})
		}
	}
}

func TestCORS_Preflight_AuthorizedOrigin_Returns204WithHeaders(t *testing.T) {
	allowedOrigin := "http://localhost:5173"
	router := chi.NewRouter()
	router.Use(httpapi.CORSMiddleware(allowedOrigin))
	router.Get("/api/v1/meters", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/meters", nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "Authorization")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content for authorized preflight, got %d", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("expected Access-Control-Allow-Origin %q, got %q", allowedOrigin, got)
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(got, "GET") {
		t.Fatalf("expected Access-Control-Allow-Methods to contain GET, got %q", got)
	}
}

func TestAuthHandler_UnconfiguredSecret_LoginFails(t *testing.T) {
	// Initialize auth service with empty secret
	unconfiguredSvc := appauth.NewService("")
	authHandler := httpapi.NewAuthHandler(unconfiguredSvc)

	r := chi.NewRouter()
	r.Post("/api/v1/auth/login", authHandler.Login)

	loginPayload := map[string]string{
		"username": "elena.morales",
		"password": "Elena#Bia2026",
	}
	bodyBytes, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// Must fail: login cannot succeed without configured secret
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when secret is unconfigured, got %d", w.Code)
	}

	var resp map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if !strings.Contains(resp["error"], "clave secreta JWT no configurada") {
		t.Fatalf("expected error regarding unconfigured secret, got: %v", resp)
	}
	if resp["token"] != "" {
		t.Fatal("token MUST NOT be returned when secret is unconfigured")
	}
}

func TestAuthHandler_UnconfiguredSecret_MiddlewareRejectsAllTokens(t *testing.T) {
	// 1. Generate valid token with a configured service
	configuredSvc := appauth.NewService("configured_key_1234567890_test")
	sess, err := configuredSvc.Authenticate("elena.morales", "Elena#Bia2026")
	if err != nil {
		t.Fatalf("failed to authenticate: %v", err)
	}

	// 2. Set up server with unconfigured auth service
	unconfiguredSvc := appauth.NewService("")
	r := chi.NewRouter()
	r.Use(httpapi.AuthMiddleware(unconfiguredSvc))
	r.Get("/protected", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// 3. Request with token generated previously
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+sess.Token)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	// 4. Must be rejected with 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized from unconfigured validator, got %d", w.Code)
	}
}
