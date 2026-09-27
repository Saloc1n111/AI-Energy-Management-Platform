package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

var ErrMissingJWTSecret = errors.New("JWT_SECRET is required: no default or hardcoded secret allowed in production")

type Config struct {
	Port          string
	DBPath        string
	DataDir       string
	AllowedOrigin string
	JWTSecret     string

	// IA generativa (opcional). Sin API key se usa el explainer determinista.
	AnthropicAPIKey string
	AnthropicModel  string
	GeminiAPIKey    string
	GeminiModel     string
	AITimeout       time.Duration
	AnalyzeOnStart  bool
}

func loadDotEnv() {
	paths := []string{".env", "../.env", "backend/.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if _, exists := os.LookupEnv(k); !exists {
					_ = os.Setenv(k, v)
				}
			}
		}
		break
	}
}

func Load() Config {
	loadDotEnv()
	return Config{
		Port:            env("PORT", "8080"),
		DBPath:          env("DB_PATH", "./energy.db"),
		DataDir:         env("DATA_DIR", "./data"),
		AllowedOrigin:   env("CORS_ORIGIN", "http://localhost:5173"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		AnthropicAPIKey: os.Getenv("ANTHROPIC_API_KEY"),
		AnthropicModel:  env("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
		GeminiAPIKey:    env("GEMINI_API_KEY", os.Getenv("LLM_API_KEY")),
		GeminiModel:     env("GEMINI_MODEL", "gemini-2.0-flash"),
		AITimeout:       time.Duration(envInt("AI_TIMEOUT_SECONDS", 25)) * time.Second,
		AnalyzeOnStart:  env("ANALYZE_ON_START", "false") == "true",
	}
}

// Validate asegura que las variables requeridas para seguridad y operación existan.
func (c Config) Validate() error {
	if strings.TrimSpace(c.JWTSecret) == "" {
		return ErrMissingJWTSecret
	}
	return nil
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(k)); err == nil && n > 0 {
		return n
	}
	return def
}
