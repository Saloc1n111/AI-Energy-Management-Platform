package auth_test

import (
	"errors"
	"testing"
	"time"

	appauth "energyhub/internal/app/auth"
	domainauth "energyhub/internal/domain/auth"
)

func TestAuthService_EmptySecret_FailsAuthenticate(t *testing.T) {
	svc := appauth.NewService("")

	session, err := svc.Authenticate("elena.morales", "Elena#Bia2026")
	if err == nil {
		t.Fatal("expected error when authenticating with empty secret, got nil")
	}
	if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
		t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
	}
	if session != nil {
		t.Fatalf("expected nil session, got %+v", session)
	}
}

func TestAuthService_WhitespaceSecret_FailsAuthenticate(t *testing.T) {
	whitespaceSecrets := []string{
		" ",
		"   ",
		"\t",
		"\n",
		"  \t \n  ",
	}

	for _, secret := range whitespaceSecrets {
		t.Run("secret_len_"+string(rune('0'+len(secret))), func(t *testing.T) {
			svc := appauth.NewService(secret)
			session, err := svc.Authenticate("elena.morales", "Elena#Bia2026")
			if err == nil {
				t.Fatal("expected error with whitespace secret, got nil")
			}
			if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
				t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
			}
			if session != nil {
				t.Fatalf("expected nil session, got %+v", session)
			}
		})
	}
}

func TestAuthService_EmptySecret_FailsValidateToken(t *testing.T) {
	svc := appauth.NewService("")

	user, err := svc.ValidateToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.bogus")
	if err == nil {
		t.Fatal("expected error when validating token with empty secret, got nil")
	}
	if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
		t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
	}
	if user != nil {
		t.Fatalf("expected nil user, got %+v", user)
	}
}

func TestAuthService_WhitespaceSecret_FailsValidateToken(t *testing.T) {
	svc := appauth.NewService("   \t  ")

	user, err := svc.ValidateToken("any.token.string")
	if err == nil {
		t.Fatal("expected error when validating token with whitespace secret, got nil")
	}
	if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
		t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
	}
	if user != nil {
		t.Fatalf("expected nil user, got %+v", user)
	}
}

func TestAuthService_EmptySecret_CannotValidateValidToken(t *testing.T) {
	// 1. Generate legitimate token with valid service
	validKey := "production_grade_secret_key_32bytes!"
	validSvc := appauth.NewService(validKey)
	session, err := validSvc.Authenticate("elena.morales", "Elena#Bia2026")
	if err != nil {
		t.Fatalf("failed to create legitimate token: %v", err)
	}

	// 2. Unconfigured service must reject it unconditionally
	unconfiguredSvc := appauth.NewService("")
	user, err := unconfiguredSvc.ValidateToken(session.Token)
	if err == nil {
		t.Fatal("unconfigured service must NOT validate legitimate token")
	}
	if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
		t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
	}
	if user != nil {
		t.Fatalf("expected nil user, got %+v", user)
	}
}

func TestAuthService_AllPredefinedAccounts_FailWithEmptySecret(t *testing.T) {
	svc := appauth.NewService("")

	for _, acc := range domainauth.PredefinedAccounts {
		t.Run("username_"+acc.User.Username, func(t *testing.T) {
			_, err := svc.Authenticate(acc.User.Username, "some_password")
			if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
				t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
			}
		})
		t.Run("email_"+acc.User.Email, func(t *testing.T) {
			_, err := svc.Authenticate(acc.User.Email, "some_password")
			if !errors.Is(err, appauth.ErrUnconfiguredSecret) {
				t.Fatalf("expected ErrUnconfiguredSecret, got %v", err)
			}
		})
	}
}

func TestAuthService_GeneratedToken_ExpiresCorrectly(t *testing.T) {
	secret := "valid_test_secret_for_expiration_test"
	svc := appauth.NewService(secret)
	session, err := svc.Authenticate("elena.morales", "Elena#Bia2026")
	if err != nil {
		t.Fatalf("auth failed: %v", err)
	}

	if session.ExpiresAt.Before(time.Now().Add(23 * time.Hour)) {
		t.Fatalf("session TTL should be ~24h, got expires at: %v", session.ExpiresAt)
	}
}
