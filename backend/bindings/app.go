package bindings

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
	"github.com/MJE43/stake-pf-replay-go/internal/store"
)

type Seeds struct{ Server, Client string }
type TargetOp string

type ScanRequest struct {
	Game       string
	Seeds      Seeds
	NonceStart uint64
	NonceEnd   uint64
	Params     map[string]any
	TargetOp   TargetOp
	TargetVal  float64
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

func (a *App) GetGames() ([]games.GameSpec, error) {
	return games.ListGames(), nil
}

func (a *App) HashServerSeed(server string) (string, error) {
	h := sha256.Sum256([]byte(server))
	return hex.EncodeToString(h[:]), nil
}

func (a *App) StartScan(req ScanRequest) (ScanResult, error) {
	s := scan.NewScanner()
	res, err := s.Scan(context.Background(), scan.ScanRequest{
		Game:       req.Game,
		Seeds:      games.Seeds{Server: req.Seeds.Server, Client: req.Seeds.Client},
		NonceStart: req.NonceStart,
		NonceEnd:   req.NonceEnd,
		Params:     req.Params,
		TargetOp:   scan.TargetOp(req.TargetOp),
		TargetVal:  req.TargetVal,
		Tolerance:  req.Tolerance,
		Limit:      req.Limit,
		TimeoutMs:  req.TimeoutMs,
	})
	if err != nil {
		return ScanResult{}, err
	}

	serverHash, _ := a.HashServerSeed(req.Seeds.Server)

	run := &store.Run{
		Game:           req.Game,
		ServerSeed:     req.Seeds.Server,
		ClientSeed:     req.Seeds.Client,
		NonceStart:     req.NonceStart,
		NonceEnd:       req.NonceEnd,
		TargetOp:       string(req.TargetOp),
		TargetVal:      req.TargetVal,
		HitCount:       len(res.Hits),
		TotalEvaluated: res.Summary.TotalEvaluated,
		EngineVersion:  res.EngineVersion,
	}

	if err := a.db.SaveRun(run); err != nil {
		return ScanResult{}, err
	}

	dbHits := make([]store.Hit, len(res.Hits))
	for i, h := range res.Hits {
		dbHits[i] = store.Hit{Nonce: h.Nonce, Metric: h.Metric}
	}

	if err := a.db.SaveHits(run.ID, dbHits); err != nil {
		return ScanResult{}, err
	}

	hits := make([]Hit, len(res.Hits))
	for i, h := range res.Hits {
		hits[i] = Hit{Nonce: h.Nonce, Metric: h.Metric}
	}

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
		Echo:           req,
		TimedOut:       res.Summary.TimedOut,
		ServerSeedHash: serverHash,
	}, nil
}
