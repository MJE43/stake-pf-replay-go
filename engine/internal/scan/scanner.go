package scan

import (
	"context"
	"runtime"
	"sync"
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
)

// ScanRequest represents a scan operation request
type ScanRequest struct {
	Game       string    `json:"game"`
	ServerSeed string    `json:"server_seed"`
	ClientSeed string    `json:"client_seed"`
	NonceStart uint64    `json:"nonce_start"`
	NonceEnd   uint64    `json:"nonce_end"`
	TargetOp   TargetOp  `json:"target_op"`
	TargetVal  float64   `json:"target_val"`
	Tolerance  float64   `json:"tolerance"`
	Limit      int       `json:"limit,omitempty"`
	TimeoutMs  int       `json:"timeout_ms,omitempty"`
}

// Hit represents a single matching result
type Hit struct {
	Nonce  uint64  `json:"nonce"`
	Metric float64 `json:"metric"`
}

// Summary contains aggregate statistics
type Summary struct {
	Count  int     `json:"count"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
	Median float64 `json:"median"`
}

// ScanResult contains the complete scan results
type ScanResult struct {
	Hits           []Hit   `json:"hits"`
	Summary        Summary `json:"summary"`
	EngineVersion  string  `json:"engine_version"`
	TotalEvaluated uint64  `json:"total_evaluated"`
	TimedOut       bool    `json:"timed_out"`
}

// Scanner performs high-performance scanning across nonce ranges
type Scanner struct {
	workerCount int
}

// NewScanner creates a new scanner with optimal worker count
func NewScanner() *Scanner {
	return &Scanner{
		workerCount: runtime.GOMAXPROCS(0),
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

	// Calculate work distribution
	totalNonces := req.NonceEnd - req.NonceStart + 1
	noncesPerWorker := totalNonces / uint64(s.workerCount)
	
	// Channels for collecting results
	hitsChan := make(chan Hit, 1000)
	doneChan := make(chan bool, s.workerCount)
	
	var wg sync.WaitGroup
	var totalEvaluated uint64
	var timedOut bool

	// Start workers
	for i := 0; i < s.workerCount; i++ {
		wg.Add(1)
		
		start := req.NonceStart + uint64(i)*noncesPerWorker
		end := start + noncesPerWorker - 1
		
		// Last worker takes any remaining nonces
		if i == s.workerCount-1 {
			end = req.NonceEnd
		}
		
		go s.worker(ctx, &wg, game, req, start, end, hitsChan, &totalEvaluated)
	}

	// Collect results
	var hits []Hit
	var allMetrics []float64
	
	go func() {
		wg.Wait()
		close(hitsChan)
		doneChan <- true
	}()

	// Collect hits with optional limit
	collecting := true
	for collecting {
		select {
		case hit, ok := <-hitsChan:
			if !ok {
				collecting = false
				break
			}
			
			hits = append(hits, hit)
			allMetrics = append(allMetrics, hit.Metric)
			
			// Apply limit if specified
			if req.Limit > 0 && len(hits) >= req.Limit {
				collecting = false
			}
			
		case <-ctx.Done():
			timedOut = true
			collecting = false
			
		case <-doneChan:
			collecting = false
		}
	}

	// Calculate summary
	summary := s.calculateSummary(allMetrics)
	
	return &ScanResult{
		Hits:           hits,
		Summary:        summary,
		EngineVersion:  "go-1.0.0",
		TotalEvaluated: totalEvaluated,
		TimedOut:       timedOut,
	}, nil
}

// worker processes a range of nonces
func (s *Scanner) worker(ctx context.Context, wg *sync.WaitGroup, game games.Game, req ScanRequest, start, end uint64, hitsChan chan<- Hit, totalEvaluated *uint64) {
	defer wg.Done()
	
	floatsNeeded := game.FloatsNeeded()
	evaluated := uint64(0)
	
	for nonce := start; nonce <= end; nonce++ {
		select {
		case <-ctx.Done():
			return
		default:
		}
		
		// Generate floats for this nonce
		floats := engine.GenerateFloats(req.ServerSeed, req.ClientSeed, nonce, 0, floatsNeeded)
		
		// Evaluate game
		metric, _ := game.Evaluate(floats)
		evaluated++
		
		// Check if metric matches target
		if s.matchesTarget(metric, req.TargetOp, req.TargetVal, req.Tolerance) {
			select {
			case hitsChan <- Hit{Nonce: nonce, Metric: metric}:
			case <-ctx.Done():
				return
			}
		}
	}
	
	// Update total evaluated count (thread-safe)
	*totalEvaluated += evaluated
}

// matchesTarget checks if a metric matches the target criteria
func (s *Scanner) matchesTarget(metric float64, op TargetOp, target, tolerance float64) bool {
	switch op {
	case OpEqual:
		return abs(metric-target) <= tolerance
	case OpGreater:
		return metric > target
	case OpGreaterEqual:
		return metric >= target
	case OpLess:
		return metric < target
	case OpLessEqual:
		return metric <= target
	default:
		return false
	}
}

// calculateSummary computes aggregate statistics
func (s *Scanner) calculateSummary(metrics []float64) Summary {
	if len(metrics) == 0 {
		return Summary{}
	}
	
	// Sort for median calculation
	sorted := make([]float64, len(metrics))
	copy(sorted, metrics)
	
	// Simple sort (could use sort.Float64s for larger datasets)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	
	min := sorted[0]
	max := sorted[len(sorted)-1]
	median := sorted[len(sorted)/2]
	
	return Summary{
		Count:  len(metrics),
		Min:    min,
		Max:    max,
		Median: median,
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}