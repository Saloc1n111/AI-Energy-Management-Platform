// Package detection contiene el motor analítico: baseline, detección, correlación eléctrica,
// calidad de datos y clasificación. Es dominio puro: sin I/O, determinista y 100% testeable.
package detection

// Config agrupa los umbrales del motor. Todos son explícitos para que el resultado sea auditable.
type Config struct {
	BaselineDays         int     // días iniciales usados como periodo de referencia
	MinSamplesPerHour    int     // muestras mínimas por hora del día para confiar en el baseline
	MinRelScale          float64 // piso de la escala robusta, relativo a la mediana (evita z infinitos)
	MinRelDeviation      float64 // desviación relativa mínima de consumo para marcar una hora (0.25 = 25%)
	MinRobustZ           float64 // z-score robusto mínimo para marcar una hora
	MinSegmentHours      int     // horas marcadas mínimas para considerar un segmento (filtra ruido)
	MaxGapHours          int     // horas no marcadas toleradas dentro de un mismo segmento
	PersistentHours      int     // duración a partir de la cual un cambio es persistente
	RecoveryHours        int     // horas posteriores que deben volver a la normalidad para "recuperado"
	HighDeviationPct     float64 // desviación que por sí sola implica severidad alta
	ElectricalZ          float64 // z de la media en ventana para declarar cambio eléctrico
	QualityZ             float64 // z por lectura para declarar un problema de calidad
	MinQualityHits       int     // horas afectadas mínimas para reportar calidad de datos
	HighQualityHits      int     // horas afectadas que implican severidad alta
	EventToleranceHours  int     // distancia máxima evento ↔ inicio de ventana
	StableConsumptionPct float64 // |desviación| máxima para considerar el consumo estable
}

func DefaultConfig() Config {
	return Config{
		BaselineDays:         7,
		MinSamplesPerHour:    3,
		MinRelScale:          0.01,
		MinRelDeviation:      0.25,
		MinRobustZ:           3.5,
		MinSegmentHours:      3,
		MaxGapHours:          1,
		PersistentHours:      24,
		RecoveryHours:        6,
		HighDeviationPct:     50,
		ElectricalZ:          4,
		QualityZ:             6,
		MinQualityHits:       3,
		HighQualityHits:      5,
		EventToleranceHours:  3,
		StableConsumptionPct: 10,
	}
}
