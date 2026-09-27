package auth

import (
	"errors"
	"strings"
	"time"

	domainauth "energyhub/internal/domain/auth"
	"energyhub/internal/infrastructure/security"
)

var (
	ErrInvalidCredentials = errors.New("credenciales inválidas: verifique su usuario/correo y contraseña")
	ErrInvalidToken       = domainauth.ErrInvalidToken
	ErrTokenExpired       = domainauth.ErrTokenExpired
	ErrUnconfiguredSecret = errors.New("clave secreta JWT no configurada en el sistema")
)

type Service struct {
	accounts  []domainauth.UserAccount
	secretKey string
	tokenTTL  time.Duration
}

func NewService(secretKey string) *Service {
	return &Service{
		accounts:  domainauth.PredefinedAccounts,
		secretKey: secretKey,
		tokenTTL:  24 * time.Hour,
	}
}

// Authenticate valida las credenciales por usuario o correo y retorna la sesión con token JWT.
func (s *Service) Authenticate(identifier, password string) (*domainauth.Session, error) {
	if strings.TrimSpace(s.secretKey) == "" {
		return nil, ErrUnconfiguredSecret
	}
	if strings.TrimSpace(identifier) == "" || strings.TrimSpace(password) == "" {
		return nil, ErrInvalidCredentials
	}

	var found *domainauth.UserAccount
	for i := range s.accounts {
		if s.accounts[i].MatchesIdentifier(identifier) {
			found = &s.accounts[i]
			break
		}
	}

	if found == nil || !security.VerifyPassword(password, found.PasswordSalt, found.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	expiresAt := time.Now().Add(s.tokenTTL)
	token, err := security.GenerateJWT(found.User, expiresAt, s.secretKey)
	if err != nil {
		return nil, err
	}

	return &domainauth.Session{
		Token:     token,
		ExpiresAt: expiresAt,
		User:      found.User,
	}, nil
}

// ValidateToken valida la integridad y expiración de un JWT y retorna el usuario asociado.
func (s *Service) ValidateToken(tokenString string) (*domainauth.User, error) {
	if strings.TrimSpace(s.secretKey) == "" {
		return nil, ErrUnconfiguredSecret
	}
	claims, err := security.ValidateJWT(tokenString, s.secretKey)
	if err != nil {
		return nil, err
	}

	for _, acc := range s.accounts {
		if acc.ID == claims.Subject {
			u := acc.User
			return &u, nil
		}
	}

	// Si no está en predefinidos, reconstruir el usuario a partir de los claims del JWT
	return &domainauth.User{
		ID:       claims.Subject,
		Username: claims.Username,
		Email:    claims.Email,
		Name:     claims.Name,
		Role:     claims.Role,
		Plant:    claims.Plant,
		Initials: claims.Initials,
	}, nil
}
