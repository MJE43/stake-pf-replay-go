package store

import (
	"database/sql"
	"time"
)

// DB represents the database interface
type DB interface {
	Close() error
	Migrate() error
	SaveRun(run *Run) error
	SaveHits(runID string, hits []Hit) error
	GetRun(id string) (*Run, error)
	GetHits(runID string, limit, offset int) ([]Hit, error)
}

// Run represents a scan run
type Run struct {
	ID            string    `json:"id" db:"id"`
	Game          string    `json:"game" db:"game"`
	ServerSeed    string    `json:"server_seed" db:"server_seed"`
	ClientSeed    string    `json:"client_seed" db:"client_seed"`
	NonceStart    uint64    `json:"nonce_start" db:"nonce_start"`
	NonceEnd      uint64    `json:"nonce_end" db:"nonce_end"`
	TargetOp      string    `json:"target_op" db:"target_op"`
	TargetVal     float64   `json:"target_val" db:"target_val"`
	HitCount      int       `json:"hit_count" db:"hit_count"`
	TotalEvaluated uint64   `json:"total_evaluated" db:"total_evaluated"`
	EngineVersion string    `json:"engine_version" db:"engine_version"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// Hit represents a single matching result
type Hit struct {
	ID     int64   `json:"id" db:"id"`
	RunID  string  `json:"run_id" db:"run_id"`
	Nonce  uint64  `json:"nonce" db:"nonce"`
	Metric float64 `json:"metric" db:"metric"`
	Details string `json:"details" db:"details"` // JSON string
}