package store

import (
	"time"
)

// DB represents the database interface
type DB interface {
	Close() error
	Migrate() error
	SaveRun(run *Run) error
	UpdateRun(run *Run) error
	SaveHits(runID string, hits []Hit) error
	GetRun(id string) (*Run, error)
	GetHits(runID string, limit, offset int) ([]Hit, error)
	ListRuns(query RunsQuery) (*RunsList, error)
	GetRunHits(runID string, page, perPage int) (*HitsPage, error)
}

// RunsQuery represents query parameters for listing runs
type RunsQuery struct {
	Game     string `json:"game,omitempty"`
	Page     int    `json:"page"`
	PerPage  int    `json:"perPage"`
}

// RunsList represents paginated runs response
type RunsList struct {
	Runs       []Run `json:"runs"`
	TotalCount int   `json:"totalCount"`
	Page       int   `json:"page"`
	PerPage    int   `json:"perPage"`
	TotalPages int   `json:"totalPages"`
}

// HitsPage represents paginated hits response with delta nonce calculation
type HitsPage struct {
	Hits       []HitWithDelta `json:"hits"`
	TotalCount int            `json:"totalCount"`
	Page       int            `json:"page"`
	PerPage    int            `json:"perPage"`
	TotalPages int            `json:"totalPages"`
}

// Run represents a scan run
type Run struct {
	ID             string    `json:"id" db:"id"`
	Game           string    `json:"game" db:"game"`
	ServerSeed     string    `json:"server_seed" db:"server_seed"`           // Deprecated: for backward compatibility
	ServerSeedHash string    `json:"server_seed_hash" db:"server_seed_hash"` // SHA256 hash only
	ClientSeed     string    `json:"client_seed" db:"client_seed"`
	NonceStart     uint64    `json:"nonce_start" db:"nonce_start"`
	NonceEnd       uint64    `json:"nonce_end" db:"nonce_end"`
	ParamsJSON     string    `json:"params_json" db:"params_json"`
	TargetOp       string    `json:"target_op" db:"target_op"`
	TargetVal      float64   `json:"target_val" db:"target_val"`
	Tolerance      float64   `json:"tolerance" db:"tolerance"`
	HitLimit       int       `json:"hit_limit" db:"hit_limit"`
	TimedOut       bool      `json:"timed_out" db:"timed_out"`
	HitCount       int       `json:"hit_count" db:"hit_count"`
	TotalEvaluated uint64    `json:"total_evaluated" db:"total_evaluated"`
	SummaryMin     *float64  `json:"summary_min" db:"summary_min"`
	SummaryMax     *float64  `json:"summary_max" db:"summary_max"`
	SummarySum     *float64  `json:"summary_sum" db:"summary_sum"`
	SummaryCount   int       `json:"summary_count" db:"summary_count"`
	EngineVersion  string    `json:"engine_version" db:"engine_version"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// Hit represents a single matching result
type Hit struct {
	ID      int64   `json:"id" db:"id"`
	RunID   string  `json:"run_id" db:"run_id"`
	Nonce   uint64  `json:"nonce" db:"nonce"`
	Metric  float64 `json:"metric" db:"metric"`
	Details string  `json:"details" db:"details"` // JSON string
}

// HitWithDelta represents a hit with calculated delta nonce
type HitWithDelta struct {
	Hit
	DeltaNonce *uint64 `json:"delta_nonce,omitempty"`
}