package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	appanalysis "energyhub/internal/app/analysis"
	"energyhub/internal/app/anomalies"
	appauth "energyhub/internal/app/auth"
	appcopilot "energyhub/internal/app/copilot"
	"energyhub/internal/app/dashboard"
	"energyhub/internal/app/meters"
	appvisits "energyhub/internal/app/visits"
	"energyhub/internal/config"
	"energyhub/internal/domain/detection"
	"energyhub/internal/infrastructure/ai"
	"energyhub/internal/infrastructure/httpapi"
	"energyhub/internal/infrastructure/seed"
	"energyhub/internal/infrastructure/sqlite"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)
	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("configuration error: %w", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := sqlite.Open(cfg.DBPath)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := sqlite.Migrate(db); err != nil {
		return err
	}
	if err := seed.NewCSVSeeder(db, cfg.DataDir, log).Run(ctx); err != nil {
		return fmt.Errorf("seed: %w", err)
	}

	// Adaptadores de salida
	meterRepo := sqlite.NewMeterRepository(db)
	readingRepo := sqlite.NewReadingRepository(db)
	eventRepo := sqlite.NewEventRepository(db)
	anomalyRepo := sqlite.NewAnomalyRepository(db)
	runRepo := sqlite.NewAnalysisRepository(db)
	visitRepo := sqlite.NewVisitRepository(db)
	detCfg := detection.DefaultConfig()

	// IA: Gemini o Claude con respaldo determinista, o solo determinista si no hay API key.
	var explainer appanalysis.Explainer = ai.NewDeterministic()
	var copilotPrimary appcopilot.Explainer
	copilotFallback := ai.NewCopilotDeterministic()

	if cfg.GeminiAPIKey != "" {
		gemini := ai.NewGemini(ai.GeminiConfig{APIKey: cfg.GeminiAPIKey, Model: cfg.GeminiModel, Retries: 1},
			&http.Client{Timeout: cfg.AITimeout})
		explainer = ai.NewFallback(gemini, explainer, cfg.AITimeout, log)
		copilotPrimary = ai.NewCopilotGemini(ai.GeminiConfig{APIKey: cfg.GeminiAPIKey, Model: cfg.GeminiModel, Retries: 1},
			&http.Client{Timeout: cfg.AITimeout})
		log.Info("AI explainer and Copilot enabled with Google Gemini", "model", cfg.GeminiModel)
	} else if cfg.AnthropicAPIKey != "" {
		claude := ai.NewClaude(ai.ClaudeConfig{APIKey: cfg.AnthropicAPIKey, Model: cfg.AnthropicModel, Retries: 1},
			&http.Client{Timeout: cfg.AITimeout})
		explainer = ai.NewFallback(claude, explainer, cfg.AITimeout, log)
		log.Info("AI explainer enabled with Claude", "model", cfg.AnthropicModel)
	} else {
		log.Warn("No AI API key set: using deterministic explainer and copilot fallback")
	}

	copilotSvc := appcopilot.NewService(copilotPrimary, copilotFallback, cfg.AITimeout, log)
	visitsSvc := appvisits.NewService(visitRepo)
	authSvc := appauth.NewService(cfg.JWTSecret)

	// Casos de uso
	analysisSvc := appanalysis.NewService(appanalysis.Deps{
		Meters: meterRepo, Readings: readingRepo, Events: eventRepo, Anomalies: anomalyRepo, Runs: runRepo,
		Explainer: explainer, Config: detCfg, Logger: log, NewID: newRunID,
	})
	handlers := httpapi.Handlers{
		Meters:    httpapi.NewMeterHandler(meters.NewService(meterRepo, readingRepo, detCfg)),
		Anomalies: httpapi.NewAnomalyHandler(anomalies.NewService(anomalyRepo, meterRepo)),
		Analysis:  httpapi.NewAnalysisHandler(analysisSvc),
		Dashboard: httpapi.NewDashboardHandler(dashboard.NewService(meterRepo, readingRepo, anomalyRepo, runRepo)),
		Copilot:   httpapi.NewCopilotHandler(copilotSvc, visitsSvc),
		Auth:      httpapi.NewAuthHandler(authSvc),
	}

	if cfg.AnalyzeOnStart {
		if _, err := analysisSvc.Start(ctx); err != nil {
			log.Warn("analyze on start", "err", err)
		}
	}

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: httpapi.NewRouter(handlers, cfg.AllowedOrigin), ReadHeaderTimeout: 5 * time.Second}
	errCh := make(chan error, 1)
	go func() {
		log.Info("api listening", "port", cfg.Port)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down gracefully")
		shCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shCtx)
	}
	return nil
}

func newRunID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return "run_" + time.Now().UTC().Format("20060102T150405") + "_" + hex.EncodeToString(b)
}
