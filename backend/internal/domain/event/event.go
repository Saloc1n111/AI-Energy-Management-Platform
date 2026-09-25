package event

import (
	"context"
	"regexp"
	"strconv"
	"time"
)

type Type string

const (
	TypeOperationalChange Type = "OPERATIONAL_CHANGE"
	TypeScheduledOutage   Type = "SCHEDULED_OUTAGE"
	TypeDataQuality       Type = "DATA_QUALITY"
	TypeUnknown           Type = "UNKNOWN"
)

type Event struct {
	ID          int64
	MeterID     string
	Timestamp   time.Time
	Type        Type
	Description string
}

// ExplainsIncrease: solo un cambio operativo justifica un aumento de consumo.
// UNKNOWN significa explícitamente "no hay evento operativo reportado", así que NO explica nada.
func (e Event) ExplainsIncrease() bool { return e.Type == TypeOperationalChange }

// ExplainsDecrease: una parada programada o un cambio operativo justifican una caída.
func (e Event) ExplainsDecrease() bool {
	return e.Type == TypeScheduledOutage || e.Type == TypeOperationalChange
}

// CorroboratesDataQuality: el evento reporta un problema de lecturas.
func (e Event) CorroboratesDataQuality() bool { return e.Type == TypeDataQuality }

var durationRe = regexp.MustCompile(`(?i)(\d+)\s*(hours?|horas?|hrs?|h)\b`)

// DeclaredDurationHours extrae la duración declarada en la descripción ("... for 12 hours").
func (e Event) DeclaredDurationHours() (int, bool) {
	m := durationRe.FindStringSubmatch(e.Description)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	return n, err == nil
}

type Repository interface {
	FindAll(ctx context.Context) ([]Event, error)
	FindByMeter(ctx context.Context, meterID string) ([]Event, error)
}
