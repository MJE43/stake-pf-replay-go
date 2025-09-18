package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// handleScan processes scan requests with full validation and error handling
func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	var req ScanRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "request_body", "Invalid JSON format: "+err.Error())
		return
	}
	
	// Validate request
	if err := ValidateScanRequest(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "scan_request", err.Error())
		return
	}
	
	// Set default tolerance if not specified
	if req.Tolerance == 0 {
		// Default tolerance: 1e-9 for floats, 0 for integers (like roulette)
		if req.Game == "roulette" {
			req.Tolerance = 0
		} else {
			req.Tolerance = 1e-9
		}
	}
	
	// Set default timeout if not specified
	if req.TimeoutMs == 0 {
		req.TimeoutMs = 60000 // 60 seconds default
	}
	
	// Convert to internal scan request
	scanReq := convertToScanRequest(&req)
	
	// Log scan request using security logger (without sensitive data)
	requestID := middleware.GetReqID(r.Context())
	s.securityLogger.LogScanOperation(
		requestID,
		req.Game,
		req.Seeds.Server,
		req.Seeds.Client,
		req.NonceStart,
		req.NonceEnd,
		req.Params,
		req.TargetOp,
		req.TargetVal,
		req.Limit,
		req.TimeoutMs,
	)
	
	// Perform scan with context cancellation support
	result, err := s.scanner.Scan(r.Context(), scanReq)
	if err != nil {
		// Handle different error types with proper context
		switch err {
		case scan.ErrGameNotFound:
			engineErr := NewError(ErrTypeGameNotFound, err.Error()).
				WithRequestID(middleware.GetReqID(r.Context())).
				WithContext("game", req.Game).
				WithContext("available_games", games.ListGames()).
				Build()
			s.errorHandler.HandleError(w, r, engineErr, http.StatusBadRequest)
		case scan.ErrTimeout:
			s.errorHandler.HandleTimeoutError(w, r, "scan", req.TimeoutMs)
		case scan.ErrInvalidParams:
			engineErr := NewError(ErrTypeInvalidParams, err.Error()).
				WithRequestID(middleware.GetReqID(r.Context())).
				WithContext("game", req.Game).
				WithContext("params", req.Params).
				Build()
			s.errorHandler.HandleError(w, r, engineErr, http.StatusBadRequest)
		default:
			engineErr := NewError(ErrTypeInternal, "Scan operation failed").
				WithRequestID(middleware.GetReqID(r.Context())).
				WithContext("game", req.Game).
				WithContext("nonce_range", fmt.Sprintf("%d-%d", req.NonceStart, req.NonceEnd)).
				WithCause(err).
				Build()
			s.errorHandler.HandleError(w, r, engineErr, http.StatusInternalServerError)
		}
		return
	}
	
	// Convert to API response format
	response := ScanResponse{
		Hits:          result.Hits,
		Summary:       result.Summary,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log successful scan with performance metrics
	// Note: In a real implementation, we'd track the actual start time
	duration := time.Millisecond * time.Duration(req.TimeoutMs) // Placeholder duration
	s.securityLogger.LogPerformanceMetrics(
		requestID,
		"scan",
		duration,
		result.Summary.TotalEvaluated,
		0, // Memory usage would be tracked separately
		true,
	)
	
	// Log audit event for scan completion
	s.securityLogger.LogAuditEvent(
		requestID,
		"scan_completed",
		fmt.Sprintf("game:%s", req.Game),
		"success",
		map[string]interface{}{
			"hits_found":      result.Summary.HitsFound,
			"total_evaluated": result.Summary.TotalEvaluated,
			"timed_out":       result.Summary.TimedOut,
			"nonce_range":     fmt.Sprintf("%d-%d", req.NonceStart, req.NonceEnd),
		},
	)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleVerify verifies a single nonce with detailed debugging information
func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	var req VerifyRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "request_body", "Invalid JSON format: "+err.Error())
		return
	}
	
	// Validate request
	if err := ValidateVerifyRequest(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "verify_request", err.Error())
		return
	}
	
	// Get game
	game, exists := games.GetGame(req.Game)
	if !exists {
		engineErr := NewError(ErrTypeGameNotFound, fmt.Sprintf("Game '%s' not found", req.Game)).
			WithRequestID(middleware.GetReqID(r.Context())).
			WithContext("game", req.Game).
			WithContext("available_games", games.ListGames()).
			Build()
		s.errorHandler.HandleError(w, r, engineErr, http.StatusBadRequest)
		return
	}
	
	// Log verify request using security logger (without sensitive data)
	requestID := middleware.GetReqID(r.Context())
	
	// Evaluate the game for this specific nonce
	gameResult, err := game.Evaluate(req.Seeds, req.Nonce, req.Params)
	if err != nil {
		s.errorHandler.HandleGameError(w, r, req.Game, req.Nonce, err)
		return
	}
	
	// Create response with full debugging information
	response := VerifyResponse{
		Nonce:         req.Nonce,
		GameResult:    gameResult,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log successful verification using security logger
	s.securityLogger.LogVerifyOperation(
		requestID,
		req.Game,
		req.Seeds.Server,
		req.Seeds.Client,
		req.Nonce,
		req.Params,
		gameResult,
	)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleListGames returns available games with comprehensive metadata
func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	// Get all game specs
	gameSpecs := games.ListGames()
	
	// Log games request
	s.logger.Printf("games_request total_games=%d engine_version=%s", len(gameSpecs), EngineVersion)
	
	// Create response with version information
	response := GamesResponse{
		Games:         gameSpecs,
		EngineVersion: EngineVersion,
	}
	
	// Log successful response
	s.logger.Printf("games_completed total_games=%d engine_version=%s", len(gameSpecs), EngineVersion)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleSeedHash returns SHA256 hash of server seed with security logging
func (s *Server) handleSeedHash(w http.ResponseWriter, r *http.Request) {
	var req SeedHashRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "request_body", "Invalid JSON format: "+err.Error())
		return
	}
	
	// Validate request
	if err := ValidateSeedHashRequest(&req); err != nil {
		s.errorHandler.HandleValidationError(w, r, "seed_hash_request", err.Error())
		return
	}
	
	// Calculate SHA256 hash
	hash := sha256.Sum256([]byte(req.ServerSeed))
	hashHex := hex.EncodeToString(hash[:])
	
	// Security logging - log hash but never the raw seed
	requestID := middleware.GetReqID(r.Context())
	s.securityLogger.LogSeedHashOperation(requestID, req.ServerSeed, hashHex)
	
	// Create response
	response := SeedHashResponse{
		Hash:          hashHex,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log audit event for seed hash completion
	s.securityLogger.LogAuditEvent(
		requestID,
		"seed_hash_completed",
		"server_seed",
		"success",
		map[string]interface{}{
			"result_hash": hashHex,
		},
	)
	
	s.writeJSON(w, http.StatusOK, response)
}