package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"energyhub/internal/domain/analysis"
)

type AnalysisRepository struct{ db *sql.DB }

var _ analysis.Repository = (*AnalysisRepository)(nil)

func NewAnalysisRepository(db *sql.DB) *AnalysisRepository { return &AnalysisRepository{db: db} }

func (r *AnalysisRepository) Save(ctx context.Context, run *analysis.Run) error {
	var finished any
	if run.FinishedAt != nil {
		finished = fmtTime(*run.FinishedAt)
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO analysis_runs (id, status, started_at, finished_at, steps, summary, error)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET status = excluded.status, finished_at = excluded.finished_at,
			steps = excluded.steps, summary = excluded.summary, error = excluded.error`,
		run.ID, string(run.Status), fmtTime(run.StartedAt), finished, toJSON(run.Steps), toJSON(run.Summary), run.Error)
	return err
}

const runSelect = `SELECT id, status, started_at, finished_at, steps, summary, error FROM analysis_runs`

func (r *AnalysisRepository) FindByID(ctx context.Context, id string) (*analysis.Run, error) {
	return r.one(r.db.QueryRowContext(ctx, runSelect+" WHERE id = ?", id))
}

func (r *AnalysisRepository) FindLatest(ctx context.Context) (*analysis.Run, error) {
	return r.one(r.db.QueryRowContext(ctx, runSelect+" ORDER BY started_at DESC, rowid DESC LIMIT 1"))
}

func (r *AnalysisRepository) one(row *sql.Row) (*analysis.Run, error) {
	var run analysis.Run
	var status, started, steps, summary string
	var finished sql.NullString
	if err := row.Scan(&run.ID, &status, &started, &finished, &steps, &summary, &run.Error); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, analysis.ErrNotFound
		}
		return nil, err
	}
	run.Status, run.StartedAt = analysis.Status(status), parseTime(started)
	if finished.Valid {
		t := parseTime(finished.String)
		run.FinishedAt = &t
	}
	if err := json.Unmarshal([]byte(steps), &run.Steps); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(summary), &run.Summary); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *AnalysisRepository) Reset(ctx context.Context) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM anomalies`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM analysis_runs`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM meter_metrics`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE meters SET status = 'OK'`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM technical_visits`); err != nil {
		return err
	}
	return tx.Commit()
}
