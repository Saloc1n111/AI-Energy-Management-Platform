package event_test

import (
	"testing"

	"energyhub/internal/domain/event"
)

func TestExplains(t *testing.T) {
	cases := []struct {
		typ      event.Type
		up, down bool
	}{
		{event.TypeOperationalChange, true, true},
		{event.TypeScheduledOutage, false, true},
		{event.TypeUnknown, false, false},
		{event.TypeDataQuality, false, false},
	}
	for _, c := range cases {
		e := event.Event{Type: c.typ}
		if e.ExplainsIncrease() != c.up || e.ExplainsDecrease() != c.down {
			t.Errorf("%s: increase=%v decrease=%v", c.typ, e.ExplainsIncrease(), e.ExplainsDecrease())
		}
	}
}

func TestDeclaredDuration(t *testing.T) {
	h, ok := event.Event{Description: "Scheduled maintenance outage for 12 hours"}.DeclaredDurationHours()
	if !ok || h != 12 {
		t.Fatalf("got %d %v", h, ok)
	}
	if _, ok := (event.Event{Description: "New production line activated"}).DeclaredDurationHours(); ok {
		t.Fatal("should not find a duration")
	}
}
