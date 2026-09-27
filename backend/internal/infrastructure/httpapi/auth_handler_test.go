package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	appauth "energyhub/internal/app/auth"
)

func setupTestRouter() http.Handler {
	authSvc := appauth.NewService("test_secret_for_http")
	handlers := Handlers{
		Auth: NewAuthHandler(authSvc),
	}
	return NewRouter(handlers, "*")
}

func TestAuthHandler_Login_Success(t *testing.T) {
	router := setupTestRouter()

	testCases := []struct {
		name       string
		payload    map[string]string
		expectedID string
	}{
		{
			name: "Elena Morales por username",
			payload: map[string]string{
				"username": "elena.morales",
				"password": "Elena#Bia2026",
			},
			expectedID: "usr_elena_morales",
		},
		{
			name: "Carlos Restrepo por email",
			payload: map[string]string{
				"email":    "carlos.restrepo@bia.app",
				"password": "Carlos#Ops2026",
			},
			expectedID: "usr_carlos_restrepo",
		},
		{
			name: "Andrés Gómez por username",
			payload: map[string]string{
				"username": "andres.gomez",
				"password": "Andres#Field2026",
			},
			expectedID: "usr_andres_gomez",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
			}

			var resp struct {
				Token string `json:"token"`
				User  struct {
					ID       string `json:"id"`
					Username string `json:"username"`
					Name     string `json:"name"`
				} `json:"user"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if resp.User.ID != tc.expectedID {
				t.Errorf("expected user ID %s, got %s", tc.expectedID, resp.User.ID)
			}
			if resp.Token == "" {
				t.Error("expected non-empty token")
			}
		})
	}
}

func TestAuthHandler_Login_Unauthorized(t *testing.T) {
	router := setupTestRouter()

	testCases := []struct {
		name    string
		payload map[string]string
	}{
		{
			name: "Contraseña incorrecta",
			payload: map[string]string{
				"username": "elena.morales",
				"password": "ClaveIncorrecta",
			},
		},
		{
			name: "Clave cruzada (Elena con clave de Carlos)",
			payload: map[string]string{
				"username": "elena.morales",
				"password": "Carlos#Ops2026",
			},
		},
		{
			name: "Usuario no existente",
			payload: map[string]string{
				"username": "noexiste",
				"password": "password",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 Unauthorized, got %d: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestAuthHandler_Me(t *testing.T) {
	router := setupTestRouter()

	// 1. Obtener token válido haciendo login con Elena
	loginBody, _ := json.Marshal(map[string]string{
		"username": "elena.morales",
		"password": "Elena#Bia2026",
	})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)

	var loginResp struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(loginRec.Body.Bytes(), &loginResp)

	// 2. Probar /auth/me con token válido
	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginResp.Token)
	meRec := httptest.NewRecorder()
	router.ServeHTTP(meRec, meReq)

	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /auth/me, got %d: %s", meRec.Code, meRec.Body.String())
	}

	var user struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Role string `json:"role"`
	}
	_ = json.Unmarshal(meRec.Body.Bytes(), &user)
	if user.ID != "usr_elena_morales" {
		t.Errorf("expected user usr_elena_morales, got %s", user.ID)
	}

	// 3. Probar /auth/me sin token -> 401
	noAuthReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	noAuthRec := httptest.NewRecorder()
	router.ServeHTTP(noAuthRec, noAuthReq)
	if noAuthRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized without header, got %d", noAuthRec.Code)
	}

	// 4. Probar /auth/me con token alterado -> 401
	badAuthReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	badAuthReq.Header.Set("Authorization", "Bearer token_falso_invalido")
	badAuthRec := httptest.NewRecorder()
	router.ServeHTTP(badAuthRec, badAuthReq)
	if badAuthRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized with bad token, got %d", badAuthRec.Code)
	}
}
