package visits

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	domainvisit "energyhub/internal/domain/visit"
)

var (
	ErrMeterRequired = errors.New("el identificador del medidor (meter_id) es obligatorio")
)

type Repository = domainvisit.Repository

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateVisitRequest struct {
	MeterID      string `json:"meter_id"`
	Urgency      string `json:"urgency"`
	Reason       string `json:"reason"`
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	Notes        string `json:"notes"`
}

func (s *Service) Create(ctx context.Context, req CreateVisitRequest) (domainvisit.TechnicalVisit, error) {
	meterID := strings.TrimSpace(req.MeterID)
	if meterID == "" {
		return domainvisit.TechnicalVisit{}, ErrMeterRequired
	}
	urgency := strings.ToUpper(strings.TrimSpace(req.Urgency))
	if urgency == "" {
		urgency = "IMMEDIATE"
	}
	contactName := strings.TrimSpace(req.ContactName)
	if contactName == "" {
		contactName = "Responsable de Operaciones"
	}
	contactPhone := strings.TrimSpace(req.ContactPhone)
	if contactPhone == "" {
		contactPhone = "+57 (300) 000-0000"
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = fmt.Sprintf("Inspección técnica requerida en medidor %s por consumo inusual no programado", meterID)
	}

	b := make([]byte, 2)
	_, _ = rand.Read(b)
	ticketSuffix := strings.ToUpper(hex.EncodeToString(b))
	ticketID := fmt.Sprintf("VT-2026-%s-%s", strings.ReplaceAll(meterID, "-", ""), ticketSuffix)

	visit := domainvisit.TechnicalVisit{
		ID:           ticketID,
		MeterID:      meterID,
		Urgency:      urgency,
		Reason:       reason,
		ContactName:  contactName,
		ContactPhone: contactPhone,
		Notes:        req.Notes,
		Status:       "CONFIRMED",
		CreatedAt:    time.Now().UTC(),
	}

	if err := s.repo.Create(ctx, visit); err != nil {
		return domainvisit.TechnicalVisit{}, fmt.Errorf("create technical visit: %w", err)
	}

	return visit, nil
}

func (s *Service) List(ctx context.Context) ([]domainvisit.TechnicalVisit, error) {
	return s.repo.List(ctx)
}
