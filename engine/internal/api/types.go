package api

import (
	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// EngineError represents a structured error response with context
type EngineError struct {
	Type      string                 `json:"type"`
	Message   string                 `json:"message"`
	Context   map[string]interface{} `json:"context,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

// Error implements the error interface
func (e EngineError) Error() string {
	return e.Message
}

// Error types with proper categorization
const (
	// Input validation errors
	ErrTypeInvalidSeed   = "invalid_seed"
	ErrTypeInvalidNonce  = "invalid_nonce"
	ErrTypeInvalidParams = "invalid_params"
	ErrTypeValidation    = "validation_error"
	
	// Game-related errors
	ErrTypeGameNotFound     = "game_not_found"
	ErrTypeGameEvaluation   = "game_evaluation_error"
	
	// System errors
	ErrTypeTimeout          = "timeout"
	ErrTypeInternal         = "internal_error"
	ErrTypeRateLimit        = "rate_limit_exceeded"
	ErrTypeServiceUnavailable = "service_unavailable"
)

// ErrorCategory represents error categories for monitoring
type ErrorCategory string

const (
	CategoryValidation ErrorCategory = "validation"
	CategoryGame       ErrorCategory = "game"
	CategorySystem     ErrorCategory = "system"
	CategoryTimeout    ErrorCategory = "timeout"
)

// GetErrorCategory returns the category for an error type
func GetErrorCategory(errType string) ErrorCategory {
	switch errType {
	case ErrTypeInvalidSeed, ErrTypeInvalidNonce, ErrTypeInvalidParams, ErrTypeValidation:
		return CategoryValidation
	case ErrTypeGameNotFound, ErrTypeGameEvaluation:
		return CategoryGame
	case ErrTypeTimeout:
		return CategoryTimeout
	default:
		return CategorySystem
	}
}

// VersionInfo contains engine version information
type VersionInfo struct {
	EngineVersion string `json:"engine_version"`
	GitCommit     string `json:"git_commit,omitempty"`
	BuildTime     string `json:"build_time,omitempty"`
}

// ScanRequest represents a scan operation request (extends scan.ScanRequest)
type ScanRequest struct {
	Game       string         `json:"game"`
	Seeds      games.Seeds    `json:"seeds"`
	NonceStart uint64         `json:"nonce_start"`
	NonceEnd   uint64         `json:"nonce_end"`
	Params     map[string]any `json:"params"`
	TargetOp   string         `json:"target_op"` // "ge", "le", "eq", "gt", "lt", "between", "outside"
	TargetVal  float64        `json:"target_val"`
	TargetVal2 float64        `json:"target_val2,omitempty"` // for "between" and "outside"
	Tolerance  float64        `json:"tolerance"`              // default 1e-9 for floats, 0 for integers
	Limit      int            `json:"limit,omitempty"`
	TimeoutMs  int            `json:"timeout_ms,omitempty"`
}

// ScanResponse represents the complete scan response
type ScanResponse struct {
	Hits          []scan.Hit  `json:"hits"`
	Summary       scan.Summary `json:"summary"`
	EngineVersion string      `json:"engine_version"`
	Echo          ScanRequest `json:"echo"`
}

// VerifyRequest represents a single nonce verification request
type VerifyRequest struct {
	Game       string         `json:"game"`
	Seeds      games.Seeds    `json:"seeds"`
	Nonce      uint64         `json:"nonce"`
	Params     map[string]any `json:"params,omitempty"`
}

// VerifyResponse represents a single nonce verification response
type VerifyResponse struct {
	Nonce         uint64           `json:"nonce"`
	GameResult    games.GameResult `json:"game_result"`
	EngineVersion string           `json:"engine_version"`
	Echo          VerifyRequest    `json:"echo"`
}

// GamesResponse represents the games metadata response
type GamesResponse struct {
	Games         []games.GameSpec `json:"games"`
	EngineVersion string           `json:"engine_version"`
}

// SeedHashRequest represents a seed hashing request
type SeedHashRequest struct {
	ServerSeed string `json:"server_seed"`
}

// SeedHashResponse represents a seed hashing response
type SeedHashResponse struct {
	Hash          string `json:"hash"`
	EngineVersion string `json:"engine_version"`
	Echo          SeedHashRequest `json:"echo"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status        string `json:"status"`
	EngineVersion string `json:"engine_version"`
	Timestamp     string `json:"timestamp"`
}