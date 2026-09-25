package detection

import (
	"math"
	"time"

	"energyhub/internal/domain/reading"
)

type Direction string

const (
	DirectionUp   Direction = "UP"
	DirectionDown Direction = "DOWN"
)

// Segment es una ventana continua donde el consumo se sale del comportamiento esperado.
type Segment struct {
	Start, End   time.Time
	Hours        int
	FlaggedHours int
	Direction    Direction
	ObservedKWh  float64
	ExpectedKWh  float64
	DeviationPct float64
	MaxAbsZ      float64
	Persistent   bool // llega al final de la serie o dura >= PersistentHours
	Recovered    bool // las horas siguientes vuelven al baseline
	Electrical   ElectricalSignature

	startIdx, endIdx int
}

func (s Segment) Contains(t time.Time) bool { return !t.Before(s.Start) && !t.After(s.End) }

// hourFlag: +1 / -1 si la hora se desvía (en % y en z robusto a la vez), 0 si es normal.
func hourFlag(p Profile, r reading.Reading, cfg Config) (int, float64) {
	exp := p.ExpectedKWh(r.Timestamp)
	if exp <= 0 || !validReading(r) {
		return 0, 0
	}
	rel := (r.ConsumptionKWh - exp) / exp
	z := p.Consumption[r.Timestamp.Hour()].Z(r.ConsumptionKWh)
	if math.Abs(rel) >= cfg.MinRelDeviation && math.Abs(z) >= cfg.MinRobustZ {
		if rel > 0 {
			return 1, z
		}
		return -1, z
	}
	return 0, z
}

// DetectSegments agrupa horas anómalas consecutivas (tolerando huecos cortos) en segmentos.
func DetectSegments(p Profile, rs []reading.Reading, cfg Config) []Segment {
	var segs []Segment
	start, dir, last, flagged, maxZ := -1, 0, -1, 0, 0.0

	closeSeg := func() {
		if start >= 0 && flagged >= cfg.MinSegmentHours {
			segs = append(segs, buildSegment(p, rs, start, last, dir, flagged, maxZ, cfg))
		}
		start, dir, flagged, maxZ = -1, 0, 0, 0
	}

	for i, r := range rs {
		d, z := hourFlag(p, r, cfg)
		switch {
		case d != 0 && d == dir && i-last-1 <= cfg.MaxGapHours:
			last, flagged, maxZ = i, flagged+1, math.Max(maxZ, math.Abs(z))
		case d != 0:
			closeSeg()
			start, dir, last, flagged, maxZ = i, d, i, 1, math.Abs(z)
		case start >= 0 && i-last > cfg.MaxGapHours:
			closeSeg()
		}
	}
	closeSeg()
	return segs
}

func buildSegment(p Profile, rs []reading.Reading, from, to, dir, flagged int, maxZ float64, cfg Config) Segment {
	s := Segment{
		Start: rs[from].Timestamp, End: rs[to].Timestamp,
		Hours: to - from + 1, FlaggedHours: flagged, MaxAbsZ: round(maxZ, 2),
		Direction: DirectionUp, startIdx: from, endIdx: to,
	}
	if dir < 0 {
		s.Direction = DirectionDown
	}
	for _, r := range rs[from : to+1] {
		s.ObservedKWh += r.ConsumptionKWh
		s.ExpectedKWh += p.ExpectedKWh(r.Timestamp)
	}
	s.DeviationPct = round(pct(s.ObservedKWh, s.ExpectedKWh), 1)
	s.ObservedKWh, s.ExpectedKWh = round(s.ObservedKWh, 1), round(s.ExpectedKWh, 1)
	s.Persistent = to == len(rs)-1 || s.Hours >= cfg.PersistentHours

	// Recuperado: las siguientes RecoveryHours horas vuelven a estar dentro del umbral.
	after := rs[to+1:]
	if len(after) >= cfg.RecoveryHours {
		s.Recovered = true
		for _, r := range after[:cfg.RecoveryHours] {
			exp := p.ExpectedKWh(r.Timestamp)
			if exp > 0 && math.Abs(r.ConsumptionKWh-exp)/exp >= cfg.MinRelDeviation {
				s.Recovered = false
				break
			}
		}
	}
	return s
}
