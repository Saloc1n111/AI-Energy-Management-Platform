package auth

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("token de autenticación JWT inválido")
	ErrTokenExpired = errors.New("el token JWT ha expirado")
)

// User representa a un operador o analista autorizado en Bia EnergyHub.
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Plant    string `json:"plant"`
	Initials string `json:"initials"`
}

// UserAccount almacena al usuario junto con su sal y hash de contraseña.
type UserAccount struct {
	User
	PasswordSalt string `json:"password_salt"`
	PasswordHash string `json:"password_hash"`
}

// Session representa una sesión autenticada con token JWT y expiración.
type Session struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      User      `json:"user"`
}

// JWTClaims representa los claims oficiales (RFC 7519) + claims personalizados para Bia Energy.
type JWTClaims struct {
	Subject   string `json:"sub"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	Plant     string `json:"plant"`
	Initials  string `json:"initials"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

// MatchesIdentifier comprueba si el identificador coincide con el username o el email del usuario.
func (u *UserAccount) MatchesIdentifier(identifier string) bool {
	idLower := strings.TrimSpace(strings.ToLower(identifier))
	return strings.ToLower(u.Username) == idLower || strings.ToLower(u.Email) == idLower
}

const (
	saltElena  = "bia_salt_elena_2026"
	saltCarlos = "bia_salt_carlos_2026"
	saltAndres = "bia_salt_andres_2026"
)

// PredefinedAccounts contiene los 3 usuarios oficiales asignados a la plataforma con sus respectivas credenciales hasheadas.
var PredefinedAccounts = []UserAccount{
	{
		User: User{
			ID:       "usr_elena_morales",
			Username: "elena.morales",
			Email:    "elena.morales@bia.app",
			Name:     "Ing. Elena Morales",
			Role:     "Analista Senior de Energía",
			Plant:    "Planta Norte · Operaciones",
			Initials: "EM",
		},
		PasswordSalt: saltElena,
		PasswordHash: "b2fd224e9f05908a8856c0958910a0cc453a4ebada39c649c9dde634ec1b8600",
	},
	{
		User: User{
			ID:       "usr_carlos_restrepo",
			Username: "carlos.restrepo",
			Email:    "carlos.restrepo@bia.app",
			Name:     "Carlos Restrepo",
			Role:     "Director de Operaciones & Eficiencia",
			Plant:    "Gestión Corporativa",
			Initials: "CR",
		},
		PasswordSalt: saltCarlos,
		PasswordHash: "b1d7052dd1385a55246756a79234fea061478e89c4acfbf444aef30b899af8ef",
	},
	{
		User: User{
			ID:       "usr_andres_gomez",
			Username: "andres.gomez",
			Email:    "andres.gomez@bia.app",
			Name:     "Andrés Gómez",
			Role:     "Ingeniero de Campo & Subestaciones",
			Plant:    "Mantenimiento Técnico",
			Initials: "AG",
		},
		PasswordSalt: saltAndres,
		PasswordHash: "2045096f82cdc9d984829e71f49e7e1c8e7a9e81e49b27579698a9bb7c05f670",
	},
}
