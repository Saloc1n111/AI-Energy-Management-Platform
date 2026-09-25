package detection

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"energyhub/internal/domain/reading"
)

var ErrInsufficientData = errors.New("insufficient readings to build a baseline")

// Profile es el comportamiento esperado de un medidor, aprendido del periodo de referencia.
// El consumo y la corriente dependen de la hora del día; voltaje, FP y ratio eléctrico no.
type Profile struct {
	MeterID     string
	From, To    time.Time
	Consumption [24]Stat
	Current     [24]Stat
	Voltage     Stat
	PowerFactor Stat
	// Ratio = consumo / (V·I·FP/1000). En un medidor sano es estable; si se rompe, las
	// variables eléctricas y el consumo dejan de ser físicamente coherentes.
	Ratio    Stat
	DailyKWh float64
	Samples  int
}

func (p Profile) ExpectedKWh(t time.Time) float64     { return p.Consumption[t.Hour()].Median }
func (p Profile) ExpectedCurrent(t time.Time) float64 { return p.Current[t.Hour()].Median }

func validReading(r reading.Reading) bool {
	return r.ConsumptionKWh >= 0 && r.VoltageV > 0 && r.CurrentA >= 0 &&
		r.PowerFactor > 0 && r.PowerFactor <= 1
}

func truncDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

func sortedCopy(rs []reading.Reading) []reading.Reading {
	out := append([]reading.Reading(nil), rs...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Timestamp.Before(out[j].Timestamp) })
	return out
}

// BuildProfile construye el baseline con los primeros cfg.BaselineDays días (entrada ordenada).
func BuildProfile(meterID string, rs []reading.Reading, cfg Config) (Profile, error) {
	if len(rs) == 0 {
		return Profile{}, ErrInsufficientData
	}
	start := truncDay(rs[0].Timestamp)
	end := start.AddDate(0, 0, cfg.BaselineDays)

	var cons, cur [24][]float64
	var volt, pf, ratio []float64
	samples := 0
	for _, r := range rs {
		if r.Timestamp.Before(start) || !r.Timestamp.Before(end) || !validReading(r) {
			continue
		}
		h := r.Timestamp.Hour()
		cons[h] = append(cons[h], r.ConsumptionKWh)
		cur[h] = append(cur[h], r.CurrentA)
		volt = append(volt, r.VoltageV)
		pf = append(pf, r.PowerFactor)
		if p := r.ElectricalPowerKW(); p > 0 {
			ratio = append(ratio, r.ConsumptionKWh/p)
		}
		samples++
	}

	prof := Profile{MeterID: meterID, From: start, To: end, Samples: samples}
	for h := 0; h < 24; h++ {
		if len(cons[h]) < cfg.MinSamplesPerHour {
			return Profile{}, fmt.Errorf("%w: meter %s hour %02d has %d samples", ErrInsufficientData, meterID, h, len(cons[h]))
		}
		prof.Consumption[h] = robustStat(cons[h], cfg.MinRelScale)
		prof.Current[h] = robustStat(cur[h], cfg.MinRelScale)
		prof.DailyKWh += prof.Consumption[h].Median
	}
	prof.Voltage = robustStat(volt, cfg.MinRelScale/2)
	prof.PowerFactor = robustStat(pf, cfg.MinRelScale/2)
	prof.Ratio = robustStat(ratio, cfg.MinRelScale)
	return prof, nil
}

// SortReadings devuelve una copia ordenada por timestamp.
func SortReadings(rs []reading.Reading) []reading.Reading { return sortedCopy(rs) }
