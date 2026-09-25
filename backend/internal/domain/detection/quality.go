package detection

import (
	"math"
	"sort"
	"time"

	"energyhub/internal/domain/reading"
)

type IssueKind string

const (
	IssueVoltageOutlier          IssueKind = "VOLTAGE_OUTLIER"
	IssuePowerFactorOutlier      IssueKind = "POWER_FACTOR_OUTLIER"
	IssueElectricalInconsistency IssueKind = "ELECTRICAL_INCONSISTENCY"
	IssueMissingReading          IssueKind = "MISSING_READING"
	IssueDuplicateTimestamp      IssueKind = "DUPLICATE_TIMESTAMP"
	IssueInvalidValue            IssueKind = "INVALID_VALUE"
)

type QualityIssue struct {
	Timestamp time.Time
	Kind      IssueKind
	Metric    string
	Value     float64
	Expected  float64
	Z         float64
}

type QualityFinding struct {
	Issues                  []QualityIssue
	ByKind                  map[IssueKind]int
	AffectedHours           int
	FirstAt, LastAt         time.Time
	ObservedKWh             float64
	ExpectedKWh             float64
	ConsumptionDeviationPct float64
}

// DetectQuality busca lecturas físicamente incoherentes o inválidas. Las horas que ya
// pertenecen a un segmento de consumo se excluyen de los chequeos eléctricos: allí un
// cambio eléctrico es un síntoma del cambio de carga (M-109), no un error de medición.
func DetectQuality(p Profile, rs []reading.Reading, segs []Segment, cfg Config) *QualityFinding {
	inSegment := func(t time.Time) bool {
		for _, s := range segs {
			if s.Contains(t) {
				return true
			}
		}
		return false
	}

	var issues []QualityIssue
	for i, r := range rs {
		if i > 0 {
			gap := r.Timestamp.Sub(rs[i-1].Timestamp)
			switch {
			case gap == 0:
				issues = append(issues, QualityIssue{Timestamp: r.Timestamp, Kind: IssueDuplicateTimestamp, Metric: "timestamp"})
			case gap > time.Hour:
				missing := int(gap/time.Hour) - 1
				issues = append(issues, QualityIssue{Timestamp: rs[i-1].Timestamp.Add(time.Hour), Kind: IssueMissingReading, Metric: "timestamp", Value: float64(missing)})
			}
		}
		if !validReading(r) {
			issues = append(issues, QualityIssue{Timestamp: r.Timestamp, Kind: IssueInvalidValue, Metric: "reading"})
			continue
		}
		if inSegment(r.Timestamp) {
			continue
		}
		if z := p.Voltage.Z(r.VoltageV); math.Abs(z) >= cfg.QualityZ {
			issues = append(issues, QualityIssue{r.Timestamp, IssueVoltageOutlier, "voltage_v", r.VoltageV, p.Voltage.Median, round(z, 1)})
		}
		if z := p.PowerFactor.Z(r.PowerFactor); math.Abs(z) >= cfg.QualityZ {
			issues = append(issues, QualityIssue{r.Timestamp, IssuePowerFactorOutlier, "power_factor", r.PowerFactor, p.PowerFactor.Median, round(z, 1)})
		}
		if pw := r.ElectricalPowerKW(); pw > 0 {
			ratio := r.ConsumptionKWh / pw
			if z := p.Ratio.Z(ratio); math.Abs(z) >= cfg.QualityZ {
				issues = append(issues, QualityIssue{r.Timestamp, IssueElectricalInconsistency, "consumption_vs_vipf", round(ratio, 3), p.Ratio.Median, round(z, 1)})
			}
		}
	}

	hours := map[time.Time]bool{}
	byKind := map[IssueKind]int{}
	for _, is := range issues {
		hours[is.Timestamp] = true
		byKind[is.Kind]++
	}
	if len(hours) < cfg.MinQualityHits {
		return nil
	}

	sort.Slice(issues, func(i, j int) bool { return issues[i].Timestamp.Before(issues[j].Timestamp) })
	q := &QualityFinding{
		Issues: issues, ByKind: byKind, AffectedHours: len(hours),
		FirstAt: issues[0].Timestamp, LastAt: issues[len(issues)-1].Timestamp,
	}
	// ¿El consumo cambió durante la ventana afectada? Si no, el problema es de medición, no de carga.
	for _, r := range rs {
		if !r.Timestamp.Before(q.FirstAt) && !r.Timestamp.After(q.LastAt) {
			q.ObservedKWh += r.ConsumptionKWh
			q.ExpectedKWh += p.ExpectedKWh(r.Timestamp)
		}
	}
	q.ConsumptionDeviationPct = round(pct(q.ObservedKWh, q.ExpectedKWh), 1)
	q.ObservedKWh, q.ExpectedKWh = round(q.ObservedKWh, 1), round(q.ExpectedKWh, 1)
	return q
}
