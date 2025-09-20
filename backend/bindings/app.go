package bindings

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
	"github.com/MJE43/stake-pf-replay-go/internal/store"
)

type Seeds struct{ Server, Client string }
type TargetOp string

type ScanRequest struct {
	Game       string
	Seeds      Seeds
	NonceStart interface{} // Accept both string and uint64
	NonceEnd   interface{} // Accept both string and uint64
	Params     map[string]any
	TargetOp   interface{} // Accept both string and TargetOp
	TargetVal  interface{} // Accept both string and float64
	Tolerance  float64
	Limit      int
	TimeoutMs  int
}

type Hit struct{ Nonce uint64; Metric float64 }
type Summary struct{ Count uint64; Min, Max, Sum float64; TotalEvaluated uint64 }
type ScanResult struct {
	RunID          string
	Hits           []Hit
	Summary        Summary
	EngineVersion  string
	Echo           ScanRequest
	TimedOut       bool
	ServerSeedHash string
}

// RunsQuery represents query parameters for listing runs
type RunsQuery struct {
	Game    string `json:"game,omitempty"`
	Page    int    `json:"page"`
	PerPage int    `json:"perPage"`
}

// RunsList represents paginated runs response
type RunsList struct {
	Runs       []store.Run `json:"runs"`
	TotalCount int         `json:"totalCount"`
	Page       int         `json:"page"`
	PerPage    int         `json:"perPage"`
	TotalPages int         `json:"totalPages"`
}

// HitsPage represents paginated hits response with delta nonce calculation
type HitsPage struct {
	Hits       []store.HitWithDelta `json:"hits"`
	TotalCount int                  `json:"totalCount"`
	Page       int                  `json:"page"`
	PerPage    int                  `json:"perPage"`
	TotalPages int                  `json:"totalPages"`
}

func (a *App) GetGames() ([]games.GameSpec, error) {
	return games.ListGames(), nil
}

func (a *App) HashServerSeed(server string) (string, error) {
	h := sha256.Sum256([]byte(server))
	return hex.EncodeToString(h[:]), nil
}

func (a *App) StartScan(req ScanRequest) (ScanResult, error) {
	// Convert NonceStart to uint64 if it's a string
	var nonceStart uint64
	switch v := req.NonceStart.(type) {
	case uint64:
		nonceStart = v
	case float64:
		nonceStart = uint64(v)
	case string:
		var err error
		nonceStart, err = strconv.ParseUint(v, 10, 64)
		if err != nil {
			return ScanResult{}, fmt.Errorf("invalid nonce start: %v", v)
		}
	default:
		return ScanResult{}, fmt.Errorf("nonce start must be a number or string, got %T", v)
	}

	// Convert NonceEnd to uint64 if it's a string
	var nonceEnd uint64
	switch v := req.NonceEnd.(type) {
	case uint64:
		nonceEnd = v
	case float64:
		nonceEnd = uint64(v)
	case string:
		var err error
		nonceEnd, err = strconv.ParseUint(v, 10, 64)
		if err != nil {
			return ScanResult{}, fmt.Errorf("invalid nonce end: %v", v)
		}
	default:
		return ScanResult{}, fmt.Errorf("nonce end must be a number or string, got %T", v)
	}

	// Convert TargetOp to string if needed
	var targetOp string
	switch v := req.TargetOp.(type) {
	case string:
		targetOp = v
	case TargetOp:
		targetOp = string(v)
	default:
		return ScanResult{}, fmt.Errorf("target op must be a string, got %T", v)
	}

	// Convert TargetVal to float64 if it's a string
	var targetVal float64
	switch v := req.TargetVal.(type) {
	case float64:
		targetVal = v
	case string:
		var err error
		targetVal, err = strconv.ParseFloat(v, 64)
		if err != nil {
			return ScanResult{}, fmt.Errorf("invalid target value: %v", v)
		}
	default:
		return ScanResult{}, fmt.Errorf("target value must be a number or string, got %T", v)
	}

	// Create a cancellable context for this scan
	scanCtx, cancel := context.WithCancel(context.Background())
	
	// Create the run first to get an ID for tracking
	serverHash, _ := a.HashServerSeed(req.Seeds.Server)
	
	// Convert params to JSON
	paramsJSON := "{}"
	if req.Params != nil {
		if jsonBytes, err := json.Marshal(req.Params); err == nil {
			paramsJSON = string(jsonBytes)
		}
	}

	run := &store.Run{
		Game:           req.Game,
		ServerSeed:     req.Seeds.Server,
		ServerSeedHash: serverHash,
		ClientSeed:     req.Seeds.Client,
		NonceStart:     nonceStart,
		NonceEnd:       nonceEnd,
		ParamsJSON:     paramsJSON,
		TargetOp:       targetOp,
		TargetVal:      targetVal,
		Tolerance:      req.Tolerance,
		HitLimit:       req.Limit,
		EngineVersion:  "v1.0.0", // TODO: Get from version package
	}

	if err := a.db.SaveRun(run); err != nil {
		cancel()
		return ScanResult{}, err
	}

	// Track the cancellation function
	a.runCancelsMux.Lock()
	a.runCancels[run.ID] = cancel
	a.runCancelsMux.Unlock()

	// Ensure cleanup after scan completes
	defer func() {
		a.runCancelsMux.Lock()
		delete(a.runCancels, run.ID)
		a.runCancelsMux.Unlock()
		cancel()
	}()

	s := scan.NewScanner()
	res, err := s.Scan(scanCtx, scan.ScanRequest{
		Game:       req.Game,
		Seeds:      games.Seeds{Server: req.Seeds.Server, Client: req.Seeds.Client},
		NonceStart: nonceStart,
		NonceEnd:   nonceEnd,
		Params:     req.Params,
		TargetOp:   scan.TargetOp(targetOp),
		TargetVal:  targetVal,
		Tolerance:  req.Tolerance,
		Limit:      req.Limit,
		TimeoutMs:  req.TimeoutMs,
	})
	if err != nil {
		return ScanResult{}, err
	}

	// Update run with results
	run.HitCount = len(res.Hits)
	run.TotalEvaluated = res.Summary.TotalEvaluated
	run.TimedOut = res.Summary.TimedOut
	if len(res.Hits) > 0 {
		min := res.Summary.MinMetric
		max := res.Summary.MaxMetric
		run.SummaryMin = &min
		run.SummaryMax = &max
		run.SummaryCount = len(res.Hits)
	}

	// Update the existing run
	if err := a.db.UpdateRun(run); err != nil {
		return ScanResult{}, err
	}

	dbHits := make([]store.Hit, len(res.Hits))
	for i, h := range res.Hits {
		dbHits[i] = store.Hit{
			RunID:  run.ID,
			Nonce:  h.Nonce,
			Metric: h.Metric,
		}
	}

	if err := a.db.SaveHits(run.ID, dbHits); err != nil {
		return ScanResult{}, err
	}

	hits := make([]Hit, len(res.Hits))
	for i, h := range res.Hits {
		hits[i] = Hit{Nonce: h.Nonce, Metric: h.Metric}
	}

	// Create echo request with converted values
	echoReq := req
	echoReq.NonceStart = nonceStart
	echoReq.NonceEnd = nonceEnd
	echoReq.TargetOp = targetOp
	echoReq.TargetVal = targetVal

	return ScanResult{
		RunID: run.ID,
		Hits:  hits,
		Summary: Summary{
			Count:          uint64(res.Summary.HitsFound),
			Min:            res.Summary.MinMetric,
			Max:            res.Summary.MaxMetric,
			Sum:            0, // Not calculated in scanner
			TotalEvaluated: res.Summary.TotalEvaluated,
		},
		EngineVersion:  res.EngineVersion,
		Echo:           echoReq,
		TimedOut:       res.Summary.TimedOut,
		ServerSeedHash: serverHash,
	}, nil
}
// GetRun retrieves individual run metadata and summary
func (a *App) GetRun(runID string) (*store.Run, error) {
	return a.db.GetRun(runID)
}

// GetRunHits retrieves hits for a run with server-side pagination and delta nonce calculation
func (a *App) GetRunHits(runID string, page, perPage int) (*HitsPage, error) {
	hitsPage, err := a.db.GetRunHits(runID, page, perPage)
	if err != nil {
		return nil, err
	}

	return &HitsPage{
		Hits:       hitsPage.Hits,
		TotalCount: hitsPage.TotalCount,
		Page:       hitsPage.Page,
		PerPage:    hitsPage.PerPage,
		TotalPages: hitsPage.TotalPages,
	}, nil
}

// ListRuns retrieves runs with pagination and game-based filtering
func (a *App) ListRuns(query RunsQuery) (*RunsList, error) {
	storeQuery := store.RunsQuery{
		Game:    query.Game,
		Page:    query.Page,
		PerPage: query.PerPage,
	}

	runsList, err := a.db.ListRuns(storeQuery)
	if err != nil {
		return nil, err
	}

	return &RunsList{
		Runs:       runsList.Runs,
		TotalCount: runsList.TotalCount,
		Page:       runsList.Page,
		PerPage:    runsList.PerPage,
		TotalPages: runsList.TotalPages,
	}, nil
}

// CancelRun stops an in-progress scan
func (a *App) CancelRun(runID string) error {
	a.runCancelsMux.RLock()
	cancel, exists := a.runCancels[runID]
	a.runCancelsMux.RUnlock()

	if !exists {
		return fmt.Errorf("run %s is not currently running or does not exist", runID)
	}

	// Cancel the context
	cancel()

	return nil
}