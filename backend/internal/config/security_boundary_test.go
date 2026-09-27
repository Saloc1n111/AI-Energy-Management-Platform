package config_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"energyhub/internal/config"
)

func TestConfig_Boundary_EmptySecretFailsValidation(t *testing.T) {
	testCases := []struct {
		name      string
		jwtSecret string
	}{
		{"Empty string", ""},
		{"Single space", " "},
		{"Multiple spaces", "    "},
		{"Tabs and spaces", "\t   \t"},
		{"Newlines and tabs", "\n\r\t "},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := config.Config{
				Port:      "8080",
				JWTSecret: tc.jwtSecret,
			}
			err := cfg.Validate()
			if err == nil {
				t.Fatalf("expected validation error for JWTSecret %q, got nil", tc.jwtSecret)
			}
			if !errors.Is(err, config.ErrMissingJWTSecret) {
				t.Fatalf("expected ErrMissingJWTSecret, got %v", err)
			}
		})
	}
}

func TestConfig_Boundary_LoadWithoutEnvOrFile_FailsValidation(t *testing.T) {
	// 1. Create empty temporary directory with no .env
	tmpDir := t.TempDir()
	origWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = os.Chdir(origWd)
	}()

	// 2. Unset JWT_SECRET
	origSecret, exists := os.LookupEnv("JWT_SECRET")
	_ = os.Unsetenv("JWT_SECRET")
	defer func() {
		if exists {
			_ = os.Setenv("JWT_SECRET", origSecret)
		} else {
			_ = os.Unsetenv("JWT_SECRET")
		}
	}()

	// 3. config.Load() in this isolated context
	cfg := config.Load()

	// 4. Verify that JWTSecret is empty and cfg.Validate() returns ErrMissingJWTSecret
	if cfg.JWTSecret != "" {
		t.Fatalf("expected empty JWTSecret when unset, got %q", cfg.JWTSecret)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected cfg.Validate() to fail with ErrMissingJWTSecret, got nil")
	} else if !errors.Is(err, config.ErrMissingJWTSecret) {
		t.Fatalf("expected ErrMissingJWTSecret, got %v", err)
	}
}

func TestConfig_Boundary_DotEnvWithEmptySecret_FailsValidation(t *testing.T) {
	// 1. Create temporary directory with a .env having empty JWT_SECRET
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, ".env")
	if err := os.WriteFile(envPath, []byte("PORT=9999\nJWT_SECRET=\n"), 0644); err != nil {
		t.Fatal(err)
	}

	origWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = os.Chdir(origWd)
	}()

	origSecret, exists := os.LookupEnv("JWT_SECRET")
	_ = os.Unsetenv("JWT_SECRET")
	defer func() {
		if exists {
			_ = os.Setenv("JWT_SECRET", origSecret)
		} else {
			_ = os.Unsetenv("JWT_SECRET")
		}
	}()

	cfg := config.Load()
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected validation error when .env contains empty JWT_SECRET, got nil")
	} else if !errors.Is(err, config.ErrMissingJWTSecret) {
		t.Fatalf("expected ErrMissingJWTSecret, got %v", err)
	}
}
