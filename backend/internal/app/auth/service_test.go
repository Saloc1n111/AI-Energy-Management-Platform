package auth

import (
	"testing"
	"time"
)

func TestService_Authenticate_Success(t *testing.T) {
	svc := NewService("test_secret_key_123")

	cases := []struct {
		name       string
		identifier string
		password   string
		expectedID string
	}{
		{
			name:       "Elena por username",
			identifier: "elena.morales",
			password:   "Elena#Bia2026",
			expectedID: "usr_elena_morales",
		},
		{
			name:       "Elena por correo institucional",
			identifier: "elena.morales@bia.app",
			password:   "Elena#Bia2026",
			expectedID: "usr_elena_morales",
		},
		{
			name:       "Carlos por username",
			identifier: "carlos.restrepo",
			password:   "Carlos#Ops2026",
			expectedID: "usr_carlos_restrepo",
		},
		{
			name:       "Carlos por correo",
			identifier: "carlos.restrepo@bia.app",
			password:   "Carlos#Ops2026",
			expectedID: "usr_carlos_restrepo",
		},
		{
			name:       "Andrés por username",
			identifier: "andres.gomez",
			password:   "Andres#Field2026",
			expectedID: "usr_andres_gomez",
		},
		{
			name:       "Andrés por correo",
			identifier: "andres.gomez@bia.app",
			password:   "Andres#Field2026",
			expectedID: "usr_andres_gomez",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			session, err := svc.Authenticate(tc.identifier, tc.password)
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if session == nil {
				t.Fatal("expected session, got nil")
			}
			if session.User.ID != tc.expectedID {
				t.Errorf("expected user ID %s, got %s", tc.expectedID, session.User.ID)
			}
			if session.Token == "" {
				t.Error("expected non-empty token")
			}
			if session.ExpiresAt.Before(time.Now()) {
				t.Error("expected expiration in the future")
			}

			// Validar token generado
			user, err := svc.ValidateToken(session.Token)
			if err != nil {
				t.Fatalf("expected valid token, got %v", err)
			}
			if user.ID != tc.expectedID {
				t.Errorf("expected validated user ID %s, got %s", tc.expectedID, user.ID)
			}
		})
	}
}

func TestService_Authenticate_Failures(t *testing.T) {
	svc := NewService("test_secret_key_123")

	cases := []struct {
		name       string
		identifier string
		password   string
	}{
		{
			name:       "Elena con clave incorrecta",
			identifier: "elena.morales",
			password:   "WrongPassword123",
		},
		{
			name:       "Elena con clave de Carlos (clave cruzada)",
			identifier: "elena.morales",
			password:   "Carlos#Ops2026",
		},
		{
			name:       "Carlos con clave de Andrés (clave cruzada)",
			identifier: "carlos.restrepo",
			password:   "Andres#Field2026",
		},
		{
			name:       "Usuario inexistente",
			identifier: "usuario.desconocido@bia.app",
			password:   "Cualquiera123",
		},
		{
			name:       "Campos vacíos",
			identifier: "",
			password:   "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			session, err := svc.Authenticate(tc.identifier, tc.password)
			if err == nil {
				t.Fatalf("expected error for invalid credentials, got session %v", session)
			}
		})
	}
}

func TestService_ValidateToken_Invalid(t *testing.T) {
	svc := NewService("test_secret_key_123")

	_, err := svc.ValidateToken("invalid.token")
	if err == nil {
		t.Fatal("expected error for malformed token")
	}

	_, err = svc.ValidateToken("usr_elena_morales.9999999999.invalid_signature")
	if err == nil {
		t.Fatal("expected error for invalid signature")
	}
}
