package sqlite

import (
	"context"
	"database/sql"
	"time"

	domainvisit "energyhub/internal/domain/visit"
)

type VisitRepository struct {
	db *sql.DB
}

func NewVisitRepository(db *sql.DB) *VisitRepository {
	return &VisitRepository{db: db}
}

func (r *VisitRepository) Create(ctx context.Context, v domainvisit.TechnicalVisit) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO technical_visits (id, meter_id, urgency, reason, contact_name, contact_phone, notes, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, v.ID, v.MeterID, v.Urgency, v.Reason, v.ContactName, v.ContactPhone, v.Notes, v.Status, fmtTime(v.CreatedAt))
	return err
}

func (r *VisitRepository) List(ctx context.Context) ([]domainvisit.TechnicalVisit, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, meter_id, urgency, reason, contact_name, contact_phone, notes, status, created_at
		FROM technical_visits
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domainvisit.TechnicalVisit
	for rows.Next() {
		var v domainvisit.TechnicalVisit
		var createdStr string
		if err := rows.Scan(&v.ID, &v.MeterID, &v.Urgency, &v.Reason, &v.ContactName, &v.ContactPhone, &v.Notes, &v.Status, &createdStr); err != nil {
			return nil, err
		}
		if t, err := time.Parse("2006-01-02 15:04:05", createdStr); err == nil {
			v.CreatedAt = t
		} else if t, err := time.Parse(time.RFC3339, createdStr); err == nil {
			v.CreatedAt = t
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
