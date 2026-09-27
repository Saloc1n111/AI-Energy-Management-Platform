package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	appauth "energyhub/internal/app/auth"
)

type AuthHandler struct {
	authService *appauth.Service
}

func NewAuthHandler(s *appauth.Service) *AuthHandler {
	return &AuthHandler{authService: s}
}

type loginRequestDTO struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login maneja la autenticación por usuario o correo y contraseña.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var dto loginRequestDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		writeBadRequest(w, "Cuerpo JSON inválido")
		return
	}

	identifier := dto.Username
	if identifier == "" {
		identifier = dto.Email
	}

	session, err := h.authService.Authenticate(identifier, dto.Password)
	if err != nil {
		if errors.Is(err, appauth.ErrInvalidCredentials) {
			writeJSON(w, http.StatusUnauthorized, errorBody{
				Error: "Credenciales inválidas. Verifique su usuario o correo y contraseña.",
				Code:  "UNAUTHORIZED",
			})
			return
		}
		writeBadRequest(w, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, session)
}

// Me retorna la información del usuario autenticado a partir del token Bearer.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		writeJSON(w, http.StatusUnauthorized, errorBody{
			Error: "No se proporcionó token de autorización en la cabecera.",
			Code:  "UNAUTHORIZED",
		})
		return
	}

	user, err := h.authService.ValidateToken(authHeader)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, errorBody{
			Error: err.Error(),
			Code:  "UNAUTHORIZED",
		})
		return
	}

	writeJSON(w, http.StatusOK, user)
}
