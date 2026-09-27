package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	domainauth "energyhub/internal/domain/auth"
)

var (
	ErrInvalidToken = domainauth.ErrInvalidToken
	ErrTokenExpired = domainauth.ErrTokenExpired
)

// GenerateJWT emite un token JWT conforme a RFC 7519 firmado con HS256.
func GenerateJWT(user domainauth.User, expiresAt time.Time, secretKey string) (string, error) {
	headerJSON := []byte(`{"alg":"HS256","typ":"JWT"}`)
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	now := time.Now().Unix()
	claims := domainauth.JWTClaims{
		Subject:   user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Name:      user.Name,
		Role:      user.Role,
		Plant:     user.Plant,
		Initials:  user.Initials,
		IssuedAt:  now,
		ExpiresAt: expiresAt.Unix(),
	}

	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	unsignedToken := headerB64 + "." + payloadB64
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(unsignedToken))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return unsignedToken + "." + sigB64, nil
}

// ValidateJWT valida la firma y vigencia de un JWT estándar RFC 7519 y retorna sus claims decodificados.
func ValidateJWT(tokenString, secretKey string) (*domainauth.JWTClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if strings.HasPrefix(strings.ToLower(tokenString), "bearer ") {
		tokenString = strings.TrimSpace(tokenString[7:])
	}

	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	headerB64, payloadB64, sigB64 := parts[0], parts[1], parts[2]
	unsignedToken := headerB64 + "." + payloadB64

	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(unsignedToken))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(sigB64)
	if err != nil || subtle.ConstantTimeCompare(expectedSig, actualSig) != 1 {
		return nil, ErrInvalidToken
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims domainauth.JWTClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().Unix() > claims.ExpiresAt {
		return nil, ErrTokenExpired
	}

	return &claims, nil
}
