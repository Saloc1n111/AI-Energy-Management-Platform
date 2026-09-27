package security

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

// HashPassword genera un hash SHA-256 con sal para una contraseña dada.
func HashPassword(password, salt string) string {
	h := sha256.New()
	h.Write([]byte(salt + ":" + password))
	return hex.EncodeToString(h.Sum(nil))
}

// VerifyPassword valida que la contraseña ingresada coincida con el hash almacenado usando tiempo constante.
func VerifyPassword(password, salt, expectedHash string) bool {
	computed := HashPassword(password, salt)
	return subtle.ConstantTimeCompare([]byte(computed), []byte(expectedHash)) == 1
}
