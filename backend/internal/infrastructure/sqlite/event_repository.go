package sqlite

import (
	"context"
	"database/sql"

	"energyhub/internal/domain/event"
)

type EventRepository struct{ db *sql.DB }

var _ event.Repository = (*EventRepository)(nil)

func NewEventRepository(db *sql.DB) *EventRepository { return &EventRepository{db: db} }

const eventSelect = `SELECT id, meter_id, timestamp, type, description FROM events`

func (r *EventRepository) FindAll(ctx context.Context) ([]event.Event, error) {
	return r.query(ctx, eventSelect+" ORDER BY timestamp")
}

func (r *EventRepository) FindByMeter(ctx context.Context, meterID string) ([]event.Event, error) {
	return r.query(ctx, eventSelect+" WHERE meter_id = ? ORDER BY timestamp", meterID)
}

func (r *EventRepository) query(ctx context.Context, q string, args ...any) ([]event.Event, error) {
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []event.Event
	for rows.Next() {
		var e event.Event
		var ts, typ string
		if err := rows.Scan(&e.ID, &e.MeterID, &ts, &typ, &e.Description); err != nil {
			return nil, err
		}
		e.Timestamp, e.Type = parseTime(ts), event.Type(typ)
		out = append(out, e)
	}
	return out, rows.Err()
}
