package visit

import (
	"context"
	"time"
)

// TechnicalVisit representa una solicitud formal de visita técnica agendada por el operador.
type TechnicalVisit struct {
	ID           string    `json:"id"`
	MeterID      string    `json:"meter_id"`
	Urgency      string    `json:"urgency"` // "IMMEDIATE", "PRIORITY", "SCHEDULED"
	Reason       string    `json:"reason"`
	ContactName  string    `json:"contact_name"`
	ContactPhone string    `json:"contact_phone"`
	Notes        string    `json:"notes"`
	Status       string    `json:"status"` // "CONFIRMED", "IN_PROGRESS", "COMPLETED"
	CreatedAt    time.Time `json:"created_at"`
}

// Repository define el puerto de persistencia para visitas técnicas.
type Repository interface {
	Create(ctx context.Context, v TechnicalVisit) error
	List(ctx context.Context) ([]TechnicalVisit, error)
}
