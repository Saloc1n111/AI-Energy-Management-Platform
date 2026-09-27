package config_test

import (
	"errors"
	"os"
	"strings"
	"testing"

	"energyhub/internal/config"
)

func TestConfig_Validate(t *testing.T) {
	t.Run("Fails when JWTSecret is empty", func(t *testing.T) {
		cfg := config.Config{
			Port:      "8080",
			JWTSecret: "",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error when JWTSecret is empty, got nil")
		}
		if !errors.Is(err, config.ErrMissingJWTSecret) {
			t.Fatalf("expected ErrMissingJWTSecret, got %v", err)
		}
	})

	t.Run("Fails when JWTSecret is whitespace only", func(t *testing.T) {
		cfg := config.Config{
			Port:      "8080",
			JWTSecret: "    \t \n",
		}
		err := cfg.Validate()
		if err == nil {
			t.Fatal("expected error when JWTSecret is whitespace, got nil")
		}
		if !errors.Is(err, config.ErrMissingJWTSecret) {
			t.Fatalf("expected ErrMissingJWTSecret, got %v", err)
		}
	})

	t.Run("Passes when JWTSecret is provided", func(t *testing.T) {
		cfg := config.Config{
			Port:      "8080",
			JWTSecret: "energyhub_dev_jwt_secret_remediation_2026",
		}
		if err := cfg.Validate(); err != nil {
			t.Fatalf("expected valid config, got %v", err)
		}
	})
}

func TestConfig_Load_ReadsJWTSecret(t *testing.T) {
	testSecret := "test_secret_via_env_var_999"
	_ = os.Setenv("JWT_SECRET", testSecret)
	defer os.Unsetenv("JWT_SECRET")

	cfg := config.Load()
	if cfg.JWTSecret != testSecret {
		t.Fatalf("expected JWTSecret to be %q, got %q", testSecret, cfg.JWTSecret)
	}
}

func TestConfig_NoHardcodedDefaultSecretInSource(t *testing.T) {
	paths := []string{
		"../app/auth/service.go",
		"backend/internal/app/auth/service.go",
		"../../internal/app/auth/service.go",
	}
	var content string
	for _, p := range paths {
		if data, err := os.ReadFile(p); err == nil {
			content = string(data)
			break
		}
	}
	if content != "" {
		forbidden := "bia_energy_hub_default_secret_key_2026"
		if strings.Contains(content, forbidden) {
			t.Fatalf("Found forbidden hardcoded secret %q in source file", forbidden)
		}
	}
}
