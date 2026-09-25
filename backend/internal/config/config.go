package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port, DBPath, DataDir, AllowedOrigin string

	// IA generativa (opcional). Sin API key se usa el explainer determinista.
	AnthropicAPIKey string
	AnthropicModel  string
	GeminiAPIKey    string
	GeminiModel     string
	AITimeout       time.Duration
	AnalyzeOnStart  bool
}

func Load() Config {
	return Config{
		Port:            env("PORT", "8080"),
		DBPath:          env("DB_PATH", "./energy.db"),
		DataDir:         env("DATA_DIR", "./data"),
		AllowedOrigin:   env("CORS_ORIGIN", "http://localhost:5173"),
		AnthropicAPIKey: os.Getenv("ANTHROPIC_API_KEY"),
		AnthropicModel:  env("ANTHROPIC_MODEL", "claude-sonnet-5"),
		GeminiAPIKey:    env("GEMINI_API_KEY", os.Getenv("LLM_API_KEY")),
		GeminiModel:     env("GEMINI_MODEL", "gemini-3.5-flash-lite"),
		AITimeout:       time.Duration(envInt("AI_TIMEOUT_SECONDS", 25)) * time.Second,
		AnalyzeOnStart:  env("ANALYZE_ON_START", "false") == "true",
	}
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
