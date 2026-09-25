package seed

import (
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const tsLayout = "2006-01-02 15:04:05"

type CSVSeeder struct {
	db      *sql.DB
	dataDir string
	log     *slog.Logger
}

func NewCSVSeeder(db *sql.DB, dataDir string, log *slog.Logger) *CSVSeeder {
	return &CSVSeeder{db: db, dataDir: dataDir, log: log}
}

// Run carga los CSV solo si la BD está vacía (se puede reiniciar el contenedor sin duplicar).
func (s *CSVSeeder) Run(ctx context.Context) error {
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM readings`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		s.log.Info("seed skipped: data already loaded", "readings", n)
		return nil
	}

	readings, err := readCSV(filepath.Join(s.dataDir, "readings.csv"))
	if err != nil {
		return err
	}
	events, err := readCSV(filepath.Join(s.dataDir, "events.csv"))
	if err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op si hubo Commit

	meterStmt, err := tx.PrepareContext(ctx, `INSERT OR IGNORE INTO meters (meter_id, name) VALUES (?, ?)`)
	if err != nil {
		return err
	}
	readStmt, err := tx.PrepareContext(ctx, `INSERT INTO readings
		(meter_id, timestamp, consumption_kwh, voltage_v, current_a, power_factor, status)
		VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}

	for i, row := range readings {
		line := i + 2 // +1 header, +1 base 1
		id := row["meter_id"]
		if _, err := meterStmt.ExecContext(ctx, id, "Medidor "+id); err != nil {
			return fmt.Errorf("readings.csv línea %d: %w", line, err)
		}
		ts, err := normalizeTS(row["timestamp"])
		if err != nil {
			return fmt.Errorf("readings.csv línea %d: %w", line, err)
		}
		v, err := parseFloats(row, "consumption_kwh", "voltage_v", "current_a", "power_factor")
		if err != nil {
			return fmt.Errorf("readings.csv línea %d: %w", line, err)
		}
		if _, err := readStmt.ExecContext(ctx, id, ts, v[0], v[1], v[2], v[3], row["status"]); err != nil {
			return fmt.Errorf("readings.csv línea %d: %w", line, err)
		}
	}

	evStmt, err := tx.PrepareContext(ctx, `INSERT INTO events (meter_id, timestamp, type, description) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	for i, row := range events {
		ts, err := normalizeTS(row["event_timestamp"])
		if err != nil {
			return fmt.Errorf("events.csv línea %d: %w", i+2, err)
		}
		if _, err := evStmt.ExecContext(ctx, row["meter_id"], ts, row["event_type"], row["description"]); err != nil {
			return fmt.Errorf("events.csv línea %d: %w", i+2, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	s.log.Info("seed completed", "readings", len(readings), "events", len(events))
	return nil
}

func readCSV(path string) ([]map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("abrir %s: %w", path, err)
	}
	defer f.Close()

	recs, err := csv.NewReader(f).ReadAll()
	if err != nil {
		return nil, fmt.Errorf("leer %s: %w", path, err)
	}
	if len(recs) < 2 {
		return nil, fmt.Errorf("%s no tiene datos", path)
	}
	header := recs[0]
	header[0] = strings.TrimPrefix(header[0], "\ufeff") // BOM de Excel

	out := make([]map[string]string, 0, len(recs)-1)
	for _, rec := range recs[1:] {
		m := make(map[string]string, len(header))
		for i, h := range header {
			m[strings.TrimSpace(h)] = strings.TrimSpace(rec[i])
		}
		out = append(out, m)
	}
	return out, nil
}

func normalizeTS(v string) (string, error) {
	for _, layout := range []string{tsLayout, "2006-01-02 15:04", time.RFC3339} {
		if t, err := time.Parse(layout, v); err == nil {
			return t.UTC().Format(tsLayout), nil
		}
	}
	return "", fmt.Errorf("timestamp inválido: %q", v)
}

func parseFloats(row map[string]string, keys ...string) ([]float64, error) {
	out := make([]float64, len(keys))
	for i, k := range keys {
		f, err := strconv.ParseFloat(row[k], 64)
		if err != nil {
			return nil, fmt.Errorf("columna %s: %w", k, err)
		}
		out[i] = f
	}
	return out, nil
}
