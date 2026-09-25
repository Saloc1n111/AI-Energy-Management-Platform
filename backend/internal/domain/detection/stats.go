package detection

import (
	"math"
	"sort"
)

// Stat es una estadística robusta: mediana y escala (MAD × 1.4826 ≈ desviación estándar).
// Se usa MAD y no media/σ porque un outlier no contamina el baseline.
type Stat struct {
	Median float64
	Scale  float64
	N      int
}

func median(xs []float64) float64 {
	if len(xs) == 0 {
		return math.NaN()
	}
	c := append([]float64(nil), xs...)
	sort.Float64s(c)
	n := len(c)
	if n%2 == 1 {
		return c[n/2]
	}
	return (c[n/2-1] + c[n/2]) / 2
}

func robustStat(xs []float64, minRelScale float64) Stat {
	m := median(xs)
	dev := make([]float64, len(xs))
	for i, x := range xs {
		dev[i] = math.Abs(x - m)
	}
	scale := 1.4826 * median(dev)
	if floor := math.Abs(m) * minRelScale; scale < floor {
		scale = floor
	}
	if scale == 0 || math.IsNaN(scale) {
		scale = 1e-9
	}
	return Stat{Median: m, Scale: scale, N: len(xs)}
}

// Z es el z-score robusto de x respecto a la estadística.
func (s Stat) Z(x float64) float64 { return (x - s.Median) / s.Scale }

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

func pct(observed, expected float64) float64 {
	if expected == 0 {
		return 0
	}
	return (observed - expected) / expected * 100
}

func round(x float64, decimals int) float64 {
	p := math.Pow(10, float64(decimals))
	return math.Round(x*p) / p
}
