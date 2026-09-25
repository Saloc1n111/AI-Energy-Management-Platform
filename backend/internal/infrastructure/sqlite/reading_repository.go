package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"energyhub/internal/domain/reading"
)

type ReadingRepository struct{ db *sql.DB }

var _ reading.Repository = (*ReadingRepository)(nil)

func NewReadingRepository(db *sql.DB) *ReadingRepository { return &ReadingRepository{db: db} }

const readingSelect = `SELECT meter_id, timestamp, consumption_kwh, voltage_v, current_a, power_factor, status FROM readings`

func (r *ReadingRepository) FindByMeter(ctx context.Context, meterID string, rg reading.Range) ([]reading.Reading, error) {
	q, args := readingSelect+" WHERE meter_id = ?", []any{meterID}
	if rg.From != nil {
		q += " AND timestamp >= ?"
		args = append(args, fmtTime(*rg.From))
	}
	if rg.To != nil {
		q += " AND timestamp <= ?"
		args = append(args, fmtTime(*rg.To))
	}
	return r.query(ctx, q+" ORDER BY timestamp", args...)
}

func (r *ReadingRepository) FindAll(ctx context.Context) (map[string][]reading.Reading, error) {
	rs, err := r.query(ctx, readingSelect+" ORDER BY meter_id, timestamp")
	if err != nil {
		return nil, err
	}
	out := map[string][]reading.Reading{}
	for _, rd := range rs {
		out[rd.MeterID] = append(out[rd.MeterID], rd)
	}
	return out, nil
}

func (r *ReadingRepository) TotalConsumption(ctx context.Context) (float64, error) {
	var total sql.NullFloat64
	err := r.db.QueryRowContext(ctx, `SELECT SUM(consumption_kwh) FROM readings`).Scan(&total)
	return total.Float64, err
}

func (r *ReadingRepository) query(ctx context.Context, q string, args ...any) ([]reading.Reading, error) {
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]reading.Reading, 0, 336)
	for rows.Next() {
		var rd reading.Reading
		var ts string
		if err := rows.Scan(&rd.MeterID, &ts, &rd.ConsumptionKWh, &rd.VoltageV, &rd.CurrentA, &rd.PowerFactor, &rd.Status); err != nil {
			return nil, err
		}
		if rd.Timestamp = parseTime(ts); rd.Timestamp.IsZero() {
			return nil, fmt.Errorf("parse timestamp %q", ts)
		}
		out = append(out, rd)
	}
	return out, rows.Err()
}
