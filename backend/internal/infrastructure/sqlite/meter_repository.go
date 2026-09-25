package sqlite

import (
	"context"
	"database/sql"
	"errors"

	"energyhub/internal/domain/meter"
)

type MeterRepository struct{ db *sql.DB }

var _ meter.Repository = (*MeterRepository)(nil) // verificación en compilación

func NewMeterRepository(db *sql.DB) *MeterRepository { return &MeterRepository{db: db} }

const meterSelect = `
SELECT m.id, m.meter_id, m.name, m.location, m.status, m.created_at,
       mm.current_kwh, mm.baseline_kwh, mm.variation_pct, mm.period_kwh,
       mm.top_severity, mm.top_anomaly_type, mm.analyzed_at
FROM meters m LEFT JOIN meter_metrics mm ON mm.meter_id = m.meter_id`

var sortColumns = map[meter.SortField]string{
	meter.SortMeterID:     "m.meter_id",
	meter.SortConsumption: "COALESCE(mm.current_kwh, 0)",
	meter.SortVariation:   "COALESCE(mm.variation_pct, 0)",
	meter.SortSeverity:    "CASE mm.top_severity WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 1 ELSE 0 END",
}

func (r *MeterRepository) FindAll(ctx context.Context, f meter.Filter) ([]meter.Meter, error) {
	q, args := meterSelect+" WHERE 1=1", []any{}
	if f.Status != "" {
		q += " AND m.status = ?"
		args = append(args, string(f.Status))
	}
	if f.Search != "" {
		q += " AND m.meter_id LIKE ?"
		args = append(args, "%"+f.Search+"%")
	}
	col, ok := sortColumns[f.SortBy] // whitelist: nunca se concatena input del usuario
	if !ok {
		col = sortColumns[meter.SortMeterID]
	}
	dir := "ASC"
	if f.Desc {
		dir = "DESC"
	}
	rows, err := r.db.QueryContext(ctx, q+" ORDER BY "+col+" "+dir+", m.meter_id", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []meter.Meter
	for rows.Next() {
		m, err := scanMeter(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (r *MeterRepository) FindByMeterID(ctx context.Context, id string) (*meter.Meter, error) {
	m, err := scanMeter(r.db.QueryRowContext(ctx, meterSelect+" WHERE m.meter_id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, meter.ErrNotFound
	}
	return m, err
}

func (r *MeterRepository) SaveSnapshots(ctx context.Context, snaps []meter.Snapshot) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, s := range snaps {
		if _, err := tx.ExecContext(ctx, `UPDATE meters SET status = ? WHERE meter_id = ?`, string(s.Status), s.MeterID); err != nil {
			return err
		}
		m := s.Metrics
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO meter_metrics (meter_id, current_kwh, baseline_kwh, variation_pct, period_kwh, top_severity, top_anomaly_type, analyzed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(meter_id) DO UPDATE SET
				current_kwh = excluded.current_kwh, baseline_kwh = excluded.baseline_kwh,
				variation_pct = excluded.variation_pct, period_kwh = excluded.period_kwh,
				top_severity = excluded.top_severity, top_anomaly_type = excluded.top_anomaly_type,
				analyzed_at = excluded.analyzed_at`,
			s.MeterID, m.CurrentKWh, m.BaselineKWh, m.VariationPct, m.PeriodKWh, m.TopSeverity, m.TopAnomalyType, fmtTime(m.AnalyzedAt)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *MeterRepository) UpdateStatus(ctx context.Context, meterID string, s meter.Status) error {
	res, err := r.db.ExecContext(ctx, `UPDATE meters SET status = ? WHERE meter_id = ?`, string(s), meterID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return meter.ErrNotFound
	}
	return nil
}

func scanMeter(s scanner) (*meter.Meter, error) {
	var m meter.Meter
	var status, created string
	var cur, base, varPct, period sql.NullFloat64
	var topSev, topType, analyzed sql.NullString
	if err := s.Scan(&m.ID, &m.MeterID, &m.Name, &m.Location, &status, &created,
		&cur, &base, &varPct, &period, &topSev, &topType, &analyzed); err != nil {
		return nil, err
	}
	m.Status = meter.Status(status)
	m.CreatedAt = parseTime(created)
	if cur.Valid {
		m.Metrics = &meter.Metrics{
			CurrentKWh: cur.Float64, BaselineKWh: base.Float64, VariationPct: varPct.Float64, PeriodKWh: period.Float64,
			TopSeverity: topSev.String, TopAnomalyType: topType.String, AnalyzedAt: parseTime(analyzed.String),
		}
	}
	return &m, nil
}
