package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"energyhub/internal/domain/anomaly"
)

type AnomalyRepository struct{ db *sql.DB }

var _ anomaly.Repository = (*AnomalyRepository)(nil)

func NewAnomalyRepository(db *sql.DB) *AnomalyRepository { return &AnomalyRepository{db: db} }

func (r *AnomalyRepository) ReplaceOpen(ctx context.Context, items []anomaly.Anomaly) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	ids := make([]any, 0, len(items))
	for _, a := range items {
		ids = append(ids, a.ID)
		var related any
		if a.RelatedEvent != nil {
			related = toJSON(a.RelatedEvent)
		}
		// El estado NO se sobrescribe: si un operador ya reconoció la anomalía, se respeta.
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO anomalies (id, run_id, meter_id, detected_at, window_start, window_end, type, severity,
				confidence, confidence_factors, signals, evidence, related_event, reason, recommended_action,
				investigation_steps, explained_by, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				run_id = excluded.run_id, detected_at = excluded.detected_at, window_end = excluded.window_end,
				type = excluded.type, severity = excluded.severity, confidence = excluded.confidence,
				confidence_factors = excluded.confidence_factors, signals = excluded.signals,
				evidence = excluded.evidence, related_event = excluded.related_event, reason = excluded.reason,
				recommended_action = excluded.recommended_action, investigation_steps = excluded.investigation_steps,
				explained_by = excluded.explained_by`,
			a.ID, a.RunID, a.MeterID, fmtTime(a.DetectedAt), fmtTime(a.WindowStart), fmtTime(a.WindowEnd),
			string(a.Type), string(a.Severity), a.Confidence, toJSON(a.ConfidenceFactors), toJSON(a.Signals),
			toJSON(a.Evidence), related, a.Explanation.Reason, a.Explanation.RecommendedAction,
			toJSON(a.Explanation.InvestigationSteps), a.Explanation.Source, string(a.Status)); err != nil {
			return err
		}
	}

	del := `DELETE FROM anomalies WHERE status = 'OPEN'`
	if len(ids) > 0 {
		del += ` AND id NOT IN (` + strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",") + `)`
	}
	if _, err := tx.ExecContext(ctx, del, ids...); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *AnomalyRepository) UpdateStatus(ctx context.Context, id string, s anomaly.Status) error {
	res, err := r.db.ExecContext(ctx, `UPDATE anomalies SET status = ? WHERE id = ?`, string(s), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return anomaly.ErrNotFound
	}
	return nil
}

const anomalySelect = `SELECT id, run_id, meter_id, detected_at, window_start, window_end, type, severity,
	confidence, confidence_factors, signals, evidence, related_event, reason, recommended_action,
	investigation_steps, explained_by, status FROM anomalies`

func (r *AnomalyRepository) FindAll(ctx context.Context, f anomaly.Filter) ([]anomaly.Anomaly, error) {
	q, args := anomalySelect+" WHERE 1=1", []any{}
	for col, v := range map[string]string{"meter_id": f.MeterID, "type": string(f.Type), "severity": string(f.Severity), "status": string(f.Status)} {
		if v != "" {
			q += " AND " + col + " = ?"
			args = append(args, v)
		}
	}
	rows, err := r.db.QueryContext(ctx, q+" ORDER BY window_start DESC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []anomaly.Anomaly
	for rows.Next() {
		a, err := scanAnomaly(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *AnomalyRepository) FindByID(ctx context.Context, id string) (*anomaly.Anomaly, error) {
	a, err := scanAnomaly(r.db.QueryRowContext(ctx, anomalySelect+" WHERE id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, anomaly.ErrNotFound
	}
	return a, err
}

func scanAnomaly(s scanner) (*anomaly.Anomaly, error) {
	var a anomaly.Anomaly
	var detected, wStart, wEnd, typ, sev, factors, signals, evidence, steps, status string
	var related sql.NullString
	if err := s.Scan(&a.ID, &a.RunID, &a.MeterID, &detected, &wStart, &wEnd, &typ, &sev, &a.Confidence,
		&factors, &signals, &evidence, &related, &a.Explanation.Reason, &a.Explanation.RecommendedAction,
		&steps, &a.Explanation.Source, &status); err != nil {
		return nil, err
	}
	a.DetectedAt, a.WindowStart, a.WindowEnd = parseTime(detected), parseTime(wStart), parseTime(wEnd)
	a.Type, a.Severity, a.Status = anomaly.Type(typ), anomaly.Severity(sev), anomaly.Status(status)
	for raw, dst := range map[string]any{factors: &a.ConfidenceFactors, signals: &a.Signals, evidence: &a.Evidence, steps: &a.Explanation.InvestigationSteps} {
		if err := json.Unmarshal([]byte(raw), dst); err != nil {
			return nil, err
		}
	}
	if related.Valid {
		a.RelatedEvent = &anomaly.EventRef{}
		if err := json.Unmarshal([]byte(related.String), a.RelatedEvent); err != nil {
			return nil, err
		}
	}
	return &a, nil
}
