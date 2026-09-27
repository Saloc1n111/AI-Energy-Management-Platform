package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	appauth "energyhub/internal/app/auth"
	domainauth "energyhub/internal/domain/auth"
	"energyhub/internal/infrastructure/httpapi"
	"energyhub/internal/infrastructure/security"
	"github.com/go-chi/chi/v5"
)

func setupTestSecurityRouter(secretKey string, allowedOrigin string) (http.Handler, *appauth.Service) {
	authSvc := appauth.NewService(secretKey)
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	r := chi.NewRouter()
	r.Use(httpapi.CORSMiddleware(allowedOrigin))
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", dummyHandler)
		r.Group(func(r chi.Router) {
			r.Use(httpapi.AuthMiddleware(authSvc))
			r.Get("/auth/me", dummyHandler)
			r.Get("/dashboard/summary", dummyHandler)
			r.Get("/meters", dummyHandler)
			r.Get("/anomalies", dummyHandler)
			r.Post("/ai/analyze", dummyHandler)
			r.Post("/ai/ask", dummyHandler)
			r.Get("/technical-visits", dummyHandler)
			r.Post("/technical-visits", dummyHandler)
		})
	})
	return r, authSvc
}

func TestAuthMiddleware_MissingHeader_Returns401(t *testing.T) {
	router, _ := setupTestSecurityRouter("test_secret_32bytes_long_key_2026", "http://localhost:5173")

	protectedEndpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/auth/me"},
		{http.MethodGet, "/api/v1/dashboard/summary"},
		{http.MethodGet, "/api/v1/meters"},
		{http.MethodGet, "/api/v1/anomalies"},
		{http.MethodPost, "/api/v1/ai/analyze"},
		{http.MethodPost, "/api/v1/ai/ask"},
		{http.MethodGet, "/api/v1/technical-visits"},
		{http.MethodPost, "/api/v1/technical-visits"},
	}

	for _, ep := range protectedEndpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			req := httptest.NewRequest(ep.method, ep.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Fatalf("endpoint %s %s: expected status 401, got %d", ep.method, ep.path, w.Code)
			}

			var body map[string]string
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("expected valid JSON body: %v", err)
			}
			if body["error"] == "" {
				t.Errorf("expected non-empty error message, got: %v", body)
			}
			if body["code"] != "UNAUTHORIZED" {
				t.Errorf("expected code UNAUTHORIZED, got: %q", body["code"])
			}
		})
	}
}

func TestAuthMiddleware_InvalidTokenFormats_Returns401(t *testing.T) {
	router, _ := setupTestSecurityRouter("test_secret_32bytes_long_key_2026", "http://localhost:5173")

	cases := []struct {
		name       string
		authHeader string
	}{
		{"Empty Header", ""},
		{"Whitespace Only", "   "},
		{"Missing Bearer Prefix", "random_token_string"},
		{"Basic Scheme", "Basic dXNlcjpwYXNz"},
		{"Bearer Without Token", "Bearer "},
		{"Bearer Whitespace", "Bearer    "},
		{"Malformed JWT Structure", "Bearer not.a.valid.jwt"},
		{"Tampered Signature", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfdGVzdCJ9.bad_sig"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Errorf("%s: expected status 401, got %d", tc.name, w.Code)
			}
		})
	}
}

func TestAuthMiddleware_ExpiredToken_Returns401(t *testing.T) {
	secret := "test_secret_32bytes_long_key_2026"
	router, _ := setupTestSecurityRouter(secret, "http://localhost:5173")

	expiredAt := time.Now().Add(-1 * time.Hour)
	user := domainauth.User{ID: "usr_elena_morales", Username: "elena.morales"}
	expiredToken, err := security.GenerateJWT(user, expiredAt, secret)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+expiredToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidToken_ContextInjection(t *testing.T) {
	secret := "test_secret_32bytes_long_key_2026"
	authSvc := appauth.NewService(secret)
	sess, err := authSvc.Authenticate("elena.morales", "Elena#Bia2026")
	if err != nil {
		t.Fatalf("failed to authenticate: %v", err)
	}

	var extractedUser *domainauth.User
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if u, ok := httpapi.UserFromContext(r.Context()); ok {
			extractedUser = u
		}
		w.WriteHeader(http.StatusOK)
	})

	middleware := httpapi.AuthMiddleware(authSvc)
	wrapped := middleware(testHandler)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+sess.Token)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	if extractedUser == nil {
		t.Fatal("expected user to be injected into context, got nil")
	}
	if extractedUser.ID != "usr_elena_morales" {
		t.Errorf("expected user ID usr_elena_morales, got %s", extractedUser.ID)
	}
}

func TestAuthMiddleware_NilValidator_Returns401(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := httpapi.AuthMiddleware(nil)
	wrapped := middleware(testHandler)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer some.token.here")
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when validator is nil, got %d", w.Code)
	}
}

func TestCORS_UnauthorizedOrigin_HeaderOmitted(t *testing.T) {
	router, _ := setupTestSecurityRouter("test_secret", "http://localhost:5173")

	unauthorizedOrigins := []string{
		"http://evil-attacker.site",
		"http://localhost:3000",
		"https://localhost:5173",
		"http://localhost:5173.evil.com",
		"null",
	}

	for _, origin := range unauthorizedOrigins {
		t.Run(origin, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			req.Header.Set("Origin", origin)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
			if allowOrigin != "" {
				t.Errorf("unauthorized origin %q received Access-Control-Allow-Origin: %q (MUST BE OMITTED)", origin, allowOrigin)
			}
		})
	}
}

func TestCORS_AuthorizedOrigin_HeaderEmitted(t *testing.T) {
	allowed := "http://localhost:5173"
	router, _ := setupTestSecurityRouter("test_secret", allowed)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", allowed)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != allowed {
		t.Fatalf("expected Access-Control-Allow-Origin %q, got %q", allowed, allowOrigin)
	}
	if w.Header().Get("Vary") != "Origin" {
		t.Errorf("expected Vary: Origin, got %q", w.Header().Get("Vary"))
	}
}

func TestCORS_PreflightOptions(t *testing.T) {
	allowed := "http://localhost:5173"
	router, _ := setupTestSecurityRouter("test_secret", allowed)

	// Valid preflight
	reqValid := httptest.NewRequest(http.MethodOptions, "/health", nil)
	reqValid.Header.Set("Origin", allowed)
	wValid := httptest.NewRecorder()
	router.ServeHTTP(wValid, reqValid)

	if wValid.Code != http.StatusNoContent {
		t.Errorf("preflight expected 204 No Content, got %d", wValid.Code)
	}
	if wValid.Header().Get("Access-Control-Allow-Origin") != allowed {
		t.Errorf("preflight expected %q, got %q", allowed, wValid.Header().Get("Access-Control-Allow-Origin"))
	}

	// Invalid preflight
	reqEvil := httptest.NewRequest(http.MethodOptions, "/health", nil)
	reqEvil.Header.Set("Origin", "http://evil.com")
	wEvil := httptest.NewRecorder()
	router.ServeHTTP(wEvil, reqEvil)

	if wEvil.Code != http.StatusForbidden {
		t.Errorf("evil preflight expected 403 Forbidden, got %d", wEvil.Code)
	}
	if wEvil.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("evil preflight must NOT receive allow header, got %q", wEvil.Header().Get("Access-Control-Allow-Origin"))
	}
}
