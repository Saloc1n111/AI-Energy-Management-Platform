package httpapi

import (
	"context"
	"net/http"
	"strings"

	domainauth "energyhub/internal/domain/auth"
)

type contextKey string

const (
	UserContextKey contextKey = "auth_user"
)

// TokenValidator define el contrato que debe satisfacer cualquier validador de tokens JWT.
type TokenValidator interface {
	ValidateToken(tokenString string) (*domainauth.User, error)
}

// AuthMiddleware valida la presencia y vigencia del Bearer token en la cabecera Authorization.
// Rechaza con HTTP 401 JSON si el token es inexistente, inválido o ha expirado.
// Inyecta el usuario autenticado en el contexto de la petición.
func AuthMiddleware(validator TokenValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeJSON(w, http.StatusUnauthorized, errorBody{
					Error: "Unauthorized",
					Code:  "UNAUTHORIZED",
				})
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
				writeJSON(w, http.StatusUnauthorized, errorBody{
					Error: "Unauthorized",
					Code:  "UNAUTHORIZED",
				})
				return
			}

			token := strings.TrimSpace(parts[1])
			if validator == nil {
				writeJSON(w, http.StatusUnauthorized, errorBody{
					Error: "Unauthorized",
					Code:  "UNAUTHORIZED",
				})
				return
			}

			user, err := validator.ValidateToken(token)
			if err != nil || user == nil {
				writeJSON(w, http.StatusUnauthorized, errorBody{
					Error: "Unauthorized",
					Code:  "UNAUTHORIZED",
				})
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserFromContext extrae el usuario autenticado del contexto de la petición HTTP.
func UserFromContext(ctx context.Context) (*domainauth.User, bool) {
	if ctx == nil {
		return nil, false
	}
	u, ok := ctx.Value(UserContextKey).(*domainauth.User)
	return u, ok && u != nil
}

// cors implementa una política CORS estricta que no refleja orígenes arbitrarios.
func cors(allowedOrigin string) func(http.Handler) http.Handler {
	return CORSMiddleware(allowedOrigin)
}

// CORSMiddleware implementa la validación estricta de origen CORS.
func CORSMiddleware(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			isAllowed := origin != "" && allowedOrigin != "" && (origin == allowedOrigin || allowedOrigin == "*")

			if isAllowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
				w.Header().Set("Access-Control-Expose-Headers", "Location, Content-Length")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Vary", "Origin")
			}

			if r.Method == http.MethodOptions {
				if isAllowed {
					w.WriteHeader(http.StatusNoContent)
				} else {
					w.WriteHeader(http.StatusForbidden)
				}
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
