package detection

import (
	"math"

	"energyhub/internal/domain/reading"
)

// ElectricalSignature describe cómo se movieron voltaje, corriente y FP dentro de un segmento.
type ElectricalSignature struct {
	CurrentObservedA    float64
	CurrentExpectedA    float64
	CurrentDeviationPct float64
	PFObserved          float64
	PFBaseline          float64
	PFZ                 float64
	VoltageObserved     float64
	VoltageBaseline     float64
	VoltageZ            float64
	RatioObserved       float64
	RatioBaseline       float64
	RatioZ              float64

	PowerFactorDrop          bool
	VoltageShift             bool
	RatioShift               bool
	CurrentTracksConsumption bool
}

// Changed indica cambios eléctricos que NO se explican solo por más/menos carga.
func (e ElectricalSignature) Changed() bool {
	return e.PowerFactorDrop || e.VoltageShift || e.RatioShift
}

// Correlate calcula la firma eléctrica del segmento contra el baseline.
func Correlate(p Profile, rs []reading.Reading, s *Segment, cfg Config) {
	var cur, curExp, pf, volt, ratio []float64
	for _, r := range rs[s.startIdx : s.endIdx+1] {
		cur = append(cur, r.CurrentA)
		curExp = append(curExp, p.ExpectedCurrent(r.Timestamp))
		pf = append(pf, r.PowerFactor)
		volt = append(volt, r.VoltageV)
		if pw := r.ElectricalPowerKW(); pw > 0 {
			ratio = append(ratio, r.ConsumptionKWh/pw)
		}
	}
	e := ElectricalSignature{
		CurrentObservedA: round(mean(cur), 1), CurrentExpectedA: round(mean(curExp), 1),
		PFObserved: round(mean(pf), 3), PFBaseline: round(p.PowerFactor.Median, 3),
		VoltageObserved: round(mean(volt), 1), VoltageBaseline: round(p.Voltage.Median, 1),
		RatioObserved: round(mean(ratio), 3), RatioBaseline: round(p.Ratio.Median, 3),
	}
	e.CurrentDeviationPct = round(pct(mean(cur), mean(curExp)), 1)
	e.PFZ = round(p.PowerFactor.Z(mean(pf)), 2)
	e.VoltageZ = round(p.Voltage.Z(mean(volt)), 2)
	e.RatioZ = round(p.Ratio.Z(mean(ratio)), 2)

	e.PowerFactorDrop = e.PFZ <= -cfg.ElectricalZ
	e.VoltageShift = math.Abs(e.VoltageZ) >= cfg.ElectricalZ
	e.RatioShift = math.Abs(e.RatioZ) >= cfg.ElectricalZ
	sameSign := (e.CurrentDeviationPct > 0) == (s.DeviationPct > 0)
	e.CurrentTracksConsumption = sameSign && math.Abs(e.CurrentDeviationPct) >= 0.5*math.Abs(s.DeviationPct)
	s.Electrical = e
}
