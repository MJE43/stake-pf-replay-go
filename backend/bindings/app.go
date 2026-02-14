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

type Hit struct {
	Nonce  uint64
	Metric float64
}
type Summary struct {
	Count          uint64
	Min, Max, Sum  float64
	TotalEvaluated uint64
}
type ScanResult struct {
	RunID          string
	Hits           []Hit
	Summary        Summary
	EngineVersion  string
	Echo           ScanRequest
	TimedOut       bool
	ServerSeedHash string
}

type SeedGroupSeeds struct {
	Server     string `json:"server"`
	ServerHash string `json:"serverHash"`
	Client     string `json:"client"`
}

type SeedRunGroup struct {
	Seeds SeedGroupSeeds `json:"seeds"`
	Runs  []store.Run    `json:"runs"`
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

// GetSeedRuns returns every run that shares the server/client seed combo of the provided run ID
func (a *App) GetSeedRuns(runID string) (*SeedRunGroup, error) {
	run, err := a.db.GetRun(runID)
	if err != nil {
		return nil, err
	}

	serverHash := run.ServerSeedHash
	if serverHash == "" && run.ServerSeed != "" {
		serverHash, _ = a.HashServerSeed(run.ServerSeed)
	}

	groupRuns, err := a.db.ListRunsBySeed(serverHash, run.ServerSeed, run.ClientSeed)
	if err != nil {
		return nil, err
	}

	return &SeedRunGroup{
		Seeds: SeedGroupSeeds{
			Server:     run.ServerSeed,
			ServerHash: serverHash,
			Client:     run.ClientSeed,
		},
		Runs: groupRuns,
	}, nil
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

// KenoB2BRequest represents a Keno B2B scan request from the frontend
type KenoB2BRequest struct {
	Seeds        Seeds   `json:"seeds"`
	NonceStart   interface{} `json:"nonceStart"`   // Accept both string and uint64
	NonceEnd     interface{} `json:"nonceEnd"`     // Accept both string and uint64
	Risk         string  `json:"risk"`             // "classic", "low", "medium", "high"
	PickCount    int     `json:"pickCount"`        // 1-10
	PickerMode   string  `json:"pickerMode"`       // "reproducible" or "entropy"
	B2BThreshold float64 `json:"b2bThreshold"`     // Minimum cumulative multiplier
	TopN         int     `json:"topN"`             // 0 = find all, >0 = limit
}

// KenoBet represents a single Keno bet in a B2B sequence
type KenoBet struct {
	Nonce      uint64  `json:"nonce"`
	Picks      []int   `json:"picks"`
	Draws      []int   `json:"draws"`
	Hits       int     `json:"hits"`
	Multiplier float64 `json:"multiplier"`
}

// B2BSequence represents a streak of consecutive wins
type B2BSequence struct {
	StartNonce           uint64    `json:"startNonce"`
	EndNonce             uint64    `json:"endNonce"`
	CumulativeMultiplier float64   `json:"cumulativeMultiplier"`
	StreakLength         int       `json:"streakLength"`
	Bets                 []KenoBet `json:"bets"`
}

// KenoB2BResult contains the results of a Keno B2B scan
type KenoB2BResult struct {
	Sequences      []B2BSequence `json:"sequences"`
	TotalFound     int           `json:"totalFound"`
	HighestMulti   float64       `json:"highestMulti"`
	TotalEvaluated uint64        `json:"totalEvaluated"`
	AntebotScript  string        `json:"antebotScript,omitempty"`
}

// StartKenoB2BScan starts a Keno B2B scan
func (a *App) StartKenoB2BScan(req KenoB2BRequest) (KenoB2BResult, error) {
	// Convert NonceStart to uint64
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
			return KenoB2BResult{}, fmt.Errorf("invalid nonce start: %v", v)
		}
	default:
		return KenoB2BResult{}, fmt.Errorf("nonce start must be a number or string, got %T", v)
	}

	// Convert NonceEnd to uint64
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
			return KenoB2BResult{}, fmt.Errorf("invalid nonce end: %v", v)
		}
	default:
		return KenoB2BResult{}, fmt.Errorf("nonce end must be a number or string, got %T", v)
	}

	// Convert picker mode
	pickerMode := scan.PickerModeReproducible
	if req.PickerMode == "entropy" {
		pickerMode = scan.PickerModeEntropy
	}

	// Create the scanner and run
	scanner := scan.NewKenoB2BScanner(pickerMode)
	result, err := scanner.Scan(context.Background(), scan.KenoB2BRequest{
		Seeds:        games.Seeds{Server: req.Seeds.Server, Client: req.Seeds.Client},
		NonceStart:   nonceStart,
		NonceEnd:     nonceEnd,
		Risk:         req.Risk,
		PickCount:    req.PickCount,
		PickerMode:   pickerMode,
		B2BThreshold: req.B2BThreshold,
		TopN:         req.TopN,
	})
	if err != nil {
		return KenoB2BResult{}, err
	}

	// Convert result to binding types
	sequences := make([]B2BSequence, len(result.Sequences))
	for i, seq := range result.Sequences {
		bets := make([]KenoBet, len(seq.Bets))
		for j, bet := range seq.Bets {
			bets[j] = KenoBet{
				Nonce:      bet.Nonce,
				Picks:      bet.Picks,
				Draws:      bet.Draws,
				Hits:       bet.Hits,
				Multiplier: bet.Multiplier,
			}
		}
		sequences[i] = B2BSequence{
			StartNonce:           seq.StartNonce,
			EndNonce:             seq.EndNonce,
			CumulativeMultiplier: seq.CumulativeMultiplier,
			StreakLength:         seq.StreakLength,
			Bets:                 bets,
		}
	}

	return KenoB2BResult{
		Sequences:      sequences,
		TotalFound:     result.TotalFound,
		HighestMulti:   result.HighestMulti,
		TotalEvaluated: result.TotalEvaluated,
		AntebotScript:  result.AntebotScript,
	}, nil
}

// GetKenoRisks returns the available risk levels for Keno
func (a *App) GetKenoRisks() []string {
	return games.ValidKenoRisks()
}

// ExportRunCSV exports all hits for a run as a CSV string.
// Returns the CSV content as a string that the frontend can download.
func (a *App) ExportRunCSV(runID string) (string, error) {
	run, err := a.db.GetRun(runID)
	if err != nil {
		return "", fmt.Errorf("run not found: %w", err)
	}

	// Fetch all hits (up to 100k)
	hitsPage, err := a.db.GetRunHits(runID, 1, 100000)
	if err != nil {
		return "", fmt.Errorf("failed to fetch hits: %w", err)
	}

	var csv string
	csv += "nonce,metric,details,delta_nonce\n"
	for _, h := range hitsPage.Hits {
		delta := ""
		if h.DeltaNonce != nil {
			delta = strconv.FormatUint(*h.DeltaNonce, 10)
		}
		csv += fmt.Sprintf("%d,%f,%s,%s\n",
			h.Nonce, h.Metric,
			escapeCSV(h.Details), delta)
	}

	_ = run // Used for context in future enhancements (header with seed info)
	return csv, nil
}

// escapeCSV wraps a field in quotes if it contains commas, quotes, or newlines.
func escapeCSV(s string) string {
	needsQuote := false
	for _, c := range s {
		if c == ',' || c == '"' || c == '\n' || c == '\r' {
			needsQuote = true
			break
		}
	}
	if !needsQuote {
		return s
	}
	escaped := ""
	for _, c := range s {
		if c == '"' {
			escaped += `""`
		} else {
			escaped += string(c)
		}
	}
	return `"` + escaped + `"`
}