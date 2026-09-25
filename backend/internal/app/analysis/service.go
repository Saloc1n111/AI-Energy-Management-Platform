// Package analysis implementa el caso de uso "Run AI Analysis".
package analysis

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"

	domain "energyhub/internal/domain/analysis"
	"energyhub/internal/domain/anomaly"
	"energyhub/internal/domain/detection"
	"energyhub/internal/domain/event"
	"energyhub/internal/domain/meter"
	"energyhub/internal/domain/reading"
)

// Explainer es el PUERTO de la capa de IA generativa. La clasificación ya viene decidida
// por el motor determinista; el explainer solo redacta explicación y recomendación.
type Explainer interface {
	Explain(ctx context.Context, f detection.Finding) (anomaly.Explanation, error)
	Name() string
}

type Deps struct {
	Meters             meter.Repository
	Readings           reading.Repository
	Events             event.Repository
	Anomalies          anomaly.Repository
	Runs               domain.Repository
	Explainer          Explainer
	Config             detection.Config
	Logger             *slog.Logger
	Clock              func() time.Time
	NewID              func() string
	ExplainConcurrency int
	RunTimeout         time.Duration
}

type Service struct {
	d         Deps
	mu        sync.Mutex
	runningID string
}

func NewService(d Deps) *Service {
	if d.Clock == nil {
		d.Clock = func() time.Time { return time.Now().UTC() }
	}
	if d.ExplainConcurrency <= 0 {
		d.ExplainConcurrency = 4
	}
	if d.RunTimeout <= 0 {
		d.RunTimeout = 2 * time.Minute
	}
	if d.Logger == nil {
		d.Logger = slog.Default()
	}
	return &Service{d: d}
}

// Start lanza el análisis en segundo plano y devuelve de inmediato la corrida (202 Accepted).
// Solo se permite un análisis a la vez.
func (s *Service) Start(ctx context.Context) (*domain.Run, error) {
	s.mu.Lock()
	if s.runningID != "" {
		id := s.runningID
		s.mu.Unlock()
		return &domain.Run{ID: id, Status: domain.StatusRunning}, domain.ErrAlreadyRunning
	}
	run := domain.NewRun(s.d.NewID(), s.d.Clock())
	s.runningID = run.ID
	s.mu.Unlock()

	if err := s.d.Runs.Save(ctx, run); err != nil {
		s.clearRunning()
		return nil, err
	}
	snapshot := run.Clone()
	go func() {
		defer s.clearRunning()
		bg, cancel := context.WithTimeout(context.Background(), s.d.RunTimeout)
		defer cancel()
		_ = s.Execute(bg, run)
	}()
	return snapshot, nil
}

func (s *Service) clearRunning() {
	s.mu.Lock()
	s.runningID = ""
	s.mu.Unlock()
}

func (s *Service) Get(ctx context.Context, id string) (*domain.Run, error) {
	return s.d.Runs.FindByID(ctx, id)
}

func (s *Service) Latest(ctx context.Context) (*domain.Run, error) {
	return s.d.Runs.FindLatest(ctx)
}

// Execute corre el pipeline de forma síncrona (lo usa Start y los tests).
func (s *Service) Execute(ctx context.Context, run *domain.Run) error {
	err := s.execute(ctx, run)
	if err != nil {
		s.d.Logger.Error("analysis failed", "run_id", run.ID, "err", err)
		run.Fail(err, s.d.Clock())
		s.save(run)
	}
	return err
}

func (s *Service) save(run *domain.Run) {
	// Se persiste con un contexto propio: si el análisis expiró, igual queremos guardar el estado final.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.d.Runs.Save(ctx, run); err != nil {
		s.d.Logger.Error("save run", "run_id", run.ID, "err", err)
	}
}

func (s *Service) begin(run *domain.Run, step domain.StepName) {
	_ = run.StartStep(step, s.d.Clock())
	s.save(run)
}

func (s *Service) done(run *domain.Run, step domain.StepName, detail string) {
	_ = run.CompleteStep(step, detail, s.d.Clock())
	s.save(run)
}

func (s *Service) execute(ctx context.Context, run *domain.Run) error {
	cfg := s.d.Config

	// 1. Lecturas
	s.begin(run, domain.StepReadings)
	raw, err := s.d.Readings.FindAll(ctx)
	if err != nil {
		return fmt.Errorf("load readings: %w", err)
	}
	ids := make([]string, 0, len(raw))
	readings := make(map[string][]reading.Reading, len(raw))
	total := 0
	for id, rs := range raw {
		ids = append(ids, id)
		readings[id] = detection.SortReadings(rs)
		total += len(rs)
	}
	sort.Strings(ids)
	if len(ids) == 0 {
		return fmt.Errorf("no readings to analyze")
	}
	s.done(run, domain.StepReadings, fmt.Sprintf("%d lecturas de %d medidores", total, len(ids)))

	// 2. Baseline
	s.begin(run, domain.StepBaseline)
	profiles := make(map[string]detection.Profile, len(ids))
	for _, id := range ids {
		p, err := detection.BuildProfile(id, readings[id], cfg)
		if err != nil {
			return fmt.Errorf("baseline %s: %w", id, err)
		}
		profiles[id] = p
	}
	s.done(run, domain.StepBaseline, fmt.Sprintf("Perfil horario por medidor con los primeros %d días (mediana + MAD)", cfg.BaselineDays))

	// 3. Detección
	s.begin(run, domain.StepDetection)
	segments := make(map[string][]detection.Segment, len(ids))
	quality := make(map[string]*detection.QualityFinding, len(ids))
	nSeg, nQ := 0, 0
	for _, id := range ids {
		segments[id] = detection.DetectSegments(profiles[id], readings[id], cfg)
		quality[id] = detection.DetectQuality(profiles[id], readings[id], segments[id], cfg)
		nSeg += len(segments[id])
		if quality[id] != nil {
			nQ++
		}
	}
	s.done(run, domain.StepDetection, fmt.Sprintf("%d ventanas de consumo anómalo · %d medidor(es) con lecturas inconsistentes", nSeg, nQ))

	// 4. Correlación eléctrica
	s.begin(run, domain.StepCorrelation)
	nElec := 0
	for _, id := range ids {
		for i := range segments[id] {
			detection.Correlate(profiles[id], readings[id], &segments[id][i], cfg)
			if segments[id][i].Electrical.Changed() {
				nElec++
			}
		}
	}
	s.done(run, domain.StepCorrelation, fmt.Sprintf("Consumo vs voltaje, corriente y FP: %d ventana(s) con cambios eléctricos", nElec))

	// 5. Eventos + clasificación
	s.begin(run, domain.StepEvents)
	evs, err := s.d.Events.FindAll(ctx)
	if err != nil {
		return fmt.Errorf("load events: %w", err)
	}
	evByMeter := map[string][]event.Event{}
	for _, e := range evs {
		evByMeter[e.MeterID] = append(evByMeter[e.MeterID], e)
	}
	metrics := make(map[string]detection.MeterMetrics, len(ids))
	var findings []detection.Finding
	for _, id := range ids {
		metrics[id] = detection.ComputeMetrics(profiles[id], readings[id])
		findings = append(findings, detection.Classify(id, profiles[id], segments[id], quality[id], evByMeter[id], metrics[id], cfg)...)
	}
	s.done(run, domain.StepEvents, fmt.Sprintf("%d eventos cruzados · %s", len(evs), describeTypes(findings)))

	// 6. Explicación (LLM con respaldo determinista)
	s.begin(run, domain.StepExplanation)
	explanations := s.explainAll(ctx, findings)
	llm := 0
	for _, e := range explanations {
		if strings.HasPrefix(e.Source, "claude") || strings.HasPrefix(e.Source, "gemini") {
			llm++
		}
	}
	s.done(run, domain.StepExplanation, fmt.Sprintf("%d explicaciones generadas por %s · %d con respaldo determinista", llm, s.d.Explainer.Name(), len(explanations)-llm))

	// 7. Recomendación: priorizar, persistir y actualizar el estado de los medidores
	s.begin(run, domain.StepRecommendation)
	now := s.d.Clock()
	items := make([]anomaly.Anomaly, 0, len(findings))
	for i, f := range findings {
		a, err := anomaly.New(anomaly.Params{
			ID: AnomalyID(f), RunID: run.ID, MeterID: f.MeterID, DetectedAt: now,
			WindowStart: f.WindowStart, WindowEnd: f.WindowEnd,
			Type: f.Type, Severity: f.Severity, Confidence: f.Confidence,
			ConfidenceFactors: f.Factors, Signals: f.Signals, Evidence: f.Evidence,
			RelatedEvent: f.EventRef(), Explanation: explanations[i],
		})
		if err != nil {
			return fmt.Errorf("build anomaly %s: %w", f.MeterID, err)
		}
		items = append(items, *a)
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].PriorityScore() > items[j].PriorityScore() })
	if err := s.d.Anomalies.ReplaceOpen(ctx, items); err != nil {
		return fmt.Errorf("persist anomalies: %w", err)
	}

	// Se relee para respetar estados que un operador ya cambió (p. ej. RESOLVED).
	stored, err := s.d.Anomalies.FindAll(ctx, anomaly.Filter{})
	if err != nil {
		return err
	}
	byMeter := map[string][]anomaly.Anomaly{}
	for _, a := range stored {
		byMeter[a.MeterID] = append(byMeter[a.MeterID], a)
	}
	snaps := make([]meter.Snapshot, 0, len(ids))
	for _, id := range ids {
		m := metrics[id]
		topSev, topType := topAnomaly(byMeter[id])
		snaps = append(snaps, meter.Snapshot{
			MeterID: id, Status: meter.DeriveStatus(byMeter[id]),
			Metrics: meter.Metrics{
				CurrentKWh: m.CurrentKWh, BaselineKWh: m.BaselineKWh, VariationPct: m.VariationPct,
				PeriodKWh: m.PeriodKWh, TopSeverity: topSev, TopAnomalyType: topType, AnalyzedAt: now,
			},
		})
	}
	if err := s.d.Meters.SaveSnapshots(ctx, snaps); err != nil {
		return fmt.Errorf("update meters: %w", err)
	}

	sum := summarize(items, len(ids), total, s.d.Explainer.Name(), llm)
	s.done(run, domain.StepRecommendation, fmt.Sprintf("%d anomalías detectadas · %d requieren atención prioritaria", sum.AnomaliesDetected, sum.HighPriority))
	run.Complete(sum, s.d.Clock())
	s.save(run)
	s.d.Logger.Info("analysis completed", "run_id", run.ID, "anomalies", sum.AnomaliesDetected, "high_priority", sum.HighPriority)
	return nil
}

func (s *Service) explainAll(ctx context.Context, findings []detection.Finding) []anomaly.Explanation {
	out := make([]anomaly.Explanation, len(findings))
	sem := make(chan struct{}, s.d.ExplainConcurrency)
	var wg sync.WaitGroup
	for i := range findings {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			e, err := s.d.Explainer.Explain(ctx, findings[i])
			if err != nil {
				// El adaptador ya aplica fallback; esto solo cubre un explainer sin respaldo.
				s.d.Logger.Warn("explain failed", "meter", findings[i].MeterID, "err", err)
				e = anomaly.Explanation{Reason: "Explicación no disponible.", RecommendedAction: "Revisar la evidencia manualmente.", Source: "none"}
			}
			out[i] = e
		}(i)
	}
	wg.Wait()
	return out
}

// AnomalyID es estable entre corridas (medidor + inicio de ventana), para conservar el estado.
func AnomalyID(f detection.Finding) string {
	return fmt.Sprintf("anm_%s_%s", strings.ToLower(strings.ReplaceAll(f.MeterID, "-", "")), f.WindowStart.Format("20060102T1504"))
}

func topAnomaly(items []anomaly.Anomaly) (string, string) {
	var best *anomaly.Anomaly
	for i := range items {
		a := &items[i]
		if !a.IsActionable() || a.Status == anomaly.StatusResolved {
			continue
		}
		if best == nil || a.PriorityScore() > best.PriorityScore() {
			best = a
		}
	}
	if best == nil {
		return "", ""
	}
	return string(best.Severity), string(best.Type)
}

func summarize(items []anomaly.Anomaly, meters, readings int, explainer string, llm int) domain.Summary {
	s := domain.Summary{MetersAnalyzed: meters, ReadingsAnalyzed: readings, AnomaliesDetected: len(items),
		ByType: map[string]int{}, Explainer: explainer, LLMExplained: llm, FallbackExplained: len(items) - llm}
	sum := 0.0
	for _, a := range items {
		s.ByType[string(a.Type)]++
		sum += a.Confidence
		if a.IsActionable() {
			s.Actionable++
		}
		if a.RequiresAttention() {
			s.HighPriority++
		}
	}
	if len(items) > 0 {
		s.AvgConfidence = float64(int(sum/float64(len(items))*100+0.5)) / 100
	}
	return s
}

func describeTypes(fs []detection.Finding) string {
	c := map[anomaly.Type]int{}
	for _, f := range fs {
		c[f.Type]++
	}
	return fmt.Sprintf("%d hallazgos: %d reales, %d explicables, %d falsos positivos, %d de calidad de datos",
		len(fs), c[anomaly.TypeReal], c[anomaly.TypeExplainable], c[anomaly.TypeFalsePositive], c[anomaly.TypeDataQuality])
}
