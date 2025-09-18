package scan

import (
	"context"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// TargetOp represents comparison operations for scanning
type TargetOp string

const (
	OpEqual        TargetOp = "eq"
	OpGreater      TargetOp = "gt"
	OpGreaterEqual TargetOp = "ge"
	OpLess         TargetOp = "lt"
	OpLessEqual    TargetOp = "le"
	OpBetween      TargetOp = "between"
	OpOutside      TargetOp = "outside"
)

// ScanRequest represents a scan operation request
type ScanRequest struct {
	Game       string         `json:"game"`
	Seeds      games.Seeds    `json:"seeds"`
	NonceStart uint64         `json:"nonce_start"`
	NonceEnd   uint64         `json:"nonce_end"`
	Params     map[string]any `json:"params"`
	TargetOp   TargetOp       `json:"target_op"`
	TargetVal  float64        `json:"target_val"`
	TargetVal2 float64        `json:"target_val2,omitempty"` // for "between" and "outside"
	Tolerance  float64        `json:"tolerance"`              // default 1e-9 for floats, 0 for integers
	Limit      int            `json:"limit,omitempty"`
	TimeoutMs  int            `json:"timeout_ms,omitempty"`
}

// Hit represents a single matching result
type Hit struct {
	Nonce  uint64  `json:"nonce"`
	Metric float64 `json:"metric"`
}

// Summary contains aggregate statistics
type Summary struct {
	TotalEvaluated uint64  `json:"total_evaluated"`
	HitsFound      int     `json:"hits_found"`
	MinMetric      float64 `json:"min_metric"`
	MaxMetric      float64 `json:"max_metric"`
	MeanMetric     float64 `json:"mean_metric"`
	TimedOut       bool    `json:"timed_out,omitempty"`
}

// ScanResult contains the complete scan results
type ScanResult struct {
	Hits          []Hit       `json:"hits"`
	Summary       Summary     `json:"summary"`
	EngineVersion string      `json:"engine_version"`
	Echo          ScanRequest `json:"echo"`
}

// ScanJob represents a batch of nonces to process
type ScanJob struct {
	NonceStart uint64
	NonceEnd   uint64
}

// ScanWorker processes scan jobs and sends hits to result channel
type ScanWorker struct {
	id         int
	jobs       <-chan ScanJob
	hits       chan<- Hit
	game       games.Game
	seeds      games.Seeds
	params     map[string]any
	evaluator  *TargetEvaluator
	floatPool  *sync.Pool
	evaluated  *uint64 // atomic counter
}

// Scanner performs high-performance scanning across nonce ranges
type Scanner struct {
	workerCount int
	floatPool   *sync.Pool
}

// TargetEvaluator handles target condition evaluation with tolerance
type TargetEvaluator struct {
	op        TargetOp
	val1      float64
	val2      float64 // for "between" and "outside"
	tolerance float64
}

// NewTargetEvaluator creates a new target evaluator
func NewTargetEvaluator(op TargetOp, val1, val2, tolerance float64) *TargetEvaluator {
	return &TargetEvaluator{
		op:        op,
		val1:      val1,
		val2:      val2,
		tolerance: tolerance,
	}
}

// Matches checks if a metric matches the target criteria
func (te *TargetEvaluator) Matches(metric float64) bool {
	switch te.op {
	case OpEqual:
		return abs(metric-te.val1) <= te.tolerance
	case OpGreater:
		return metric > te.val1+te.tolerance
	case OpGreaterEqual:
		return metric >= te.val1-te.tolerance
	case OpLess:
		return metric < te.val1-te.tolerance
	case OpLessEqual:
		return metric <= te.val1+te.tolerance
	case OpBetween:
		return metric >= te.val1-te.tolerance && metric <= te.val2+te.tolerance
	case OpOutside:
		return metric < te.val1-te.tolerance || metric > te.val2+te.tolerance
	default:
		return false
	}
}

// NewScanner creates a new scanner with optimal worker count
func NewScanner() *Scanner {
	// Create sync.Pool for float slice reuse
	floatPool := &sync.Pool{
		New: func() interface{} {
			// Pre-allocate slice for typical game needs (most games need 1-10 floats)
			// Use capacity of 16 to handle games that might need more floats
			return make([]float64, 0, 16)
		},
	}

	return &Scanner{
		workerCount: runtime.GOMAXPROCS(0),
		floatPool:   floatPool,
	}
}

// Scan performs a parallel scan across the specified nonce range
func (s *Scanner) Scan(ctx context.Context, req ScanRequest) (*ScanResult, error) {
	game, exists := games.GetGame(req.Game)
	if !exists {
		return nil, ErrGameNotFound
	}

	// Setup timeout context if specified
	if req.TimeoutMs > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(req.TimeoutMs)*time.Millisecond)
		defer cancel()
	}

	// Set default tolerance if not specified
	tolerance := req.Tolerance
	if tolerance == 0 {
		// Default tolerance: 1e-9 for floats, 0 for integers (like roulette)
		if req.Game == "roulette" {
			tolerance = 0
		} else {
			tolerance = 1e-9
		}
	}

	// Create target evaluator
	evaluator := NewTargetEvaluator(req.TargetOp, req.TargetVal, req.TargetVal2, tolerance)

	// Create job and result channels
	jobs := make(chan ScanJob, s.workerCount*2) // Buffer for smooth job distribution
	hits := make(chan Hit, 1000)               // Buffer for hit collection
	
	var totalEvaluated uint64
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < s.workerCount; i++ {
		worker := &ScanWorker{
			id:        i,
			jobs:      jobs,
			hits:      hits,
			game:      game,
			seeds:     req.Seeds,
			params:    req.Params,
			evaluator: evaluator,
			floatPool: s.floatPool,
			evaluated: &totalEvaluated,
		}
		
		wg.Add(1)
		go worker.Run(ctx, &wg)
	}

	// Generate jobs in a separate goroutine
	go s.generateJobs(ctx, jobs, req.NonceStart, req.NonceEnd)

	// Collect results
	resultCollector := &ResultCollector{
		hits:      hits,
		limit:     req.Limit,
		evaluated: &totalEvaluated,
	}
	
	result := resultCollector.Collect(ctx, &wg)
	
	// Add metadata
	result.EngineVersion = "go-1.0.0"
	result.Echo = req
	
	return result, nil
}

// Run starts the worker processing jobs
func (sw *ScanWorker) Run(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	
	floatsNeeded := sw.game.FloatCount(sw.params)
	
	for {
		select {
		case job, ok := <-sw.jobs:
			if !ok {
				return // Channel closed, worker should exit
			}
			
			sw.processJob(ctx, job, floatsNeeded)
			
		case <-ctx.Done():
			return
		}
	}
}

// processJob processes a single job (nonce range)
func (sw *ScanWorker) processJob(ctx context.Context, job ScanJob, floatsNeeded int) {
	// Get float slice from pool
	floats := sw.floatPool.Get().([]float64)
	defer func() {
		// Reset slice length but keep capacity for reuse
		floats = floats[:0]
		sw.floatPool.Put(floats)
	}()
	
	// Ensure slice has enough capacity
	if cap(floats) < floatsNeeded {
		floats = make([]float64, floatsNeeded)
	} else {
		floats = floats[:floatsNeeded]
	}
	
	for nonce := job.NonceStart; nonce <= job.NonceEnd; nonce++ {
		select {
		case <-ctx.Done():
			return
		default:
		}
		
		// Generate floats for this nonce using allocation-free version
		engine.FloatsInto(floats, sw.seeds.Server, sw.seeds.Client, nonce, 0, floatsNeeded)
		
		// Evaluate game
		result, err := sw.game.Evaluate(sw.seeds, nonce, sw.params)
		if err != nil {
			continue // Skip invalid evaluations
		}
		
		// Increment evaluated counter atomically
		atomic.AddUint64(sw.evaluated, 1)
		
		// Check if metric matches target
		if sw.evaluator.Matches(result.Metric) {
			// Create hit struct directly without intermediate allocations
			hit := Hit{Nonce: nonce, Metric: result.Metric}
			select {
			case sw.hits <- hit:
			case <-ctx.Done():
				return
			default:
				// Channel is full, continue processing but don't block
				// This ensures workers keep running even if hit collection is slow
			}
		}
	}
}

// generateJobs creates job batches for optimal throughput
func (s *Scanner) generateJobs(ctx context.Context, jobs chan<- ScanJob, start, end uint64) {
	defer close(jobs)
	
	const optimalBatchSize = 8192 // 8k nonces per batch for good throughput
	
	for current := start; current <= end; {
		batchEnd := current + optimalBatchSize - 1
		if batchEnd > end {
			batchEnd = end
		}
		
		job := ScanJob{
			NonceStart: current,
			NonceEnd:   batchEnd,
		}
		
		select {
		case jobs <- job:
			current = batchEnd + 1
		case <-ctx.Done():
			return
		}
	}
}

// ResultCollector aggregates scan results and computes summary statistics
type ResultCollector struct {
	hits      <-chan Hit
	limit     int
	evaluated *uint64
}

// Collect gathers hits and computes summary statistics
func (rc *ResultCollector) Collect(ctx context.Context, wg *sync.WaitGroup) *ScanResult {
	// Pre-allocate slices based on expected hit rates
	// Estimate initial capacity: if limit is set, use it; otherwise use reasonable default
	initialCap := 1000
	if rc.limit > 0 && rc.limit < initialCap {
		initialCap = rc.limit
	}
	
	collectedHits := make([]Hit, 0, initialCap)
	allMetrics := make([]float64, 0, initialCap)
	var timedOut bool
	limitReached := false
	
	// Start goroutine to close hits channel when workers are done
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	
	collecting := true
	for collecting {
		select {
		case hit, ok := <-rc.hits:
			if !ok {
				collecting = false
				break
			}
			
			// Only collect hits if we haven't reached the limit
			if !limitReached {
				collectedHits = append(collectedHits, hit)
				allMetrics = append(allMetrics, hit.Metric)
				
				// Check if we've reached the limit
				if rc.limit > 0 && len(collectedHits) >= rc.limit {
					limitReached = true
				}
			}
			// Continue draining hits even after limit is reached to let workers finish
			
		case <-ctx.Done():
			timedOut = true
			collecting = false
			
		case <-done:
			// Drain remaining hits
			for {
				select {
				case hit, ok := <-rc.hits:
					if !ok {
						collecting = false
						goto exitLoop
					}
					// Only collect if we haven't reached the limit
					if !limitReached {
						collectedHits = append(collectedHits, hit)
						allMetrics = append(allMetrics, hit.Metric)
						
						if rc.limit > 0 && len(collectedHits) >= rc.limit {
							limitReached = true
						}
					}
				default:
					collecting = false
					goto exitLoop
				}
			}
		exitLoop:
			collecting = false
		}
	}
	
	// Calculate summary statistics
	summary := rc.calculateSummary(allMetrics, atomic.LoadUint64(rc.evaluated), timedOut)
	
	return &ScanResult{
		Hits:    collectedHits,
		Summary: summary,
	}
}

// calculateSummary computes aggregate statistics
func (rc *ResultCollector) calculateSummary(metrics []float64, totalEvaluated uint64, timedOut bool) Summary {
	summary := Summary{
		TotalEvaluated: totalEvaluated,
		HitsFound:      len(metrics),
		TimedOut:       timedOut,
	}
	
	if len(metrics) == 0 {
		return summary
	}
	
	// Calculate min, max, and mean
	min := metrics[0]
	max := metrics[0]
	sum := 0.0
	
	for _, metric := range metrics {
		if metric < min {
			min = metric
		}
		if metric > max {
			max = metric
		}
		sum += metric
	}
	
	summary.MinMetric = min
	summary.MaxMetric = max
	summary.MeanMetric = sum / float64(len(metrics))
	
	return summary
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}