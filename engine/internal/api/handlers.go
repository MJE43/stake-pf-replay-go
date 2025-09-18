package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// handleScan processes scan requests with full validation and error handling
func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	var req ScanRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, "Invalid JSON format", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	
	// Validate request
	if err := ValidateScanRequest(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, err.Error(), map[string]interface{}{
			"field_errors": err.Error(),
		})
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
	
	// Log scan request (without sensitive data)
	serverHash := hashSeed(req.Seeds.Server)
	clientHash := hashSeed(req.Seeds.Client)
	log.Printf(
		"scan_request game=%s server_hash=%s client_hash=%s nonce_range=%d-%d target_op=%s target_val=%f limit=%d timeout_ms=%d",
		req.Game, serverHash, clientHash, req.NonceStart, req.NonceEnd, req.TargetOp, req.TargetVal, req.Limit, req.TimeoutMs,
	)
	
	// Perform scan with context cancellation support
	result, err := s.scanner.Scan(r.Context(), scanReq)
	if err != nil {
		// Determine error type
		errType := ErrTypeInternal
		status := http.StatusInternalServerError
		
		switch err {
		case scan.ErrGameNotFound:
			errType = ErrTypeGameNotFound
			status = http.StatusBadRequest
		case scan.ErrTimeout:
			errType = ErrTypeTimeout
			status = http.StatusRequestTimeout
		case scan.ErrInvalidParams:
			errType = ErrTypeInvalidParams
			status = http.StatusBadRequest
		}
		
		s.writeError(w, status, errType, err.Error(), map[string]interface{}{
			"game":        req.Game,
			"nonce_range": fmt.Sprintf("%d-%d", req.NonceStart, req.NonceEnd),
		})
		return
	}
	
	// Convert to API response format
	response := ScanResponse{
		Hits:          result.Hits,
		Summary:       result.Summary,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log successful scan
	log.Printf(
		"scan_completed game=%s hits_found=%d total_evaluated=%d duration_ms=%d timed_out=%t",
		req.Game, result.Summary.HitsFound, result.Summary.TotalEvaluated, req.TimeoutMs, result.Summary.TimedOut,
	)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleVerify verifies a single nonce with detailed debugging information
func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	var req VerifyRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, "Invalid JSON format", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	
	// Validate request
	if err := ValidateVerifyRequest(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, err.Error(), map[string]interface{}{
			"field_errors": err.Error(),
		})
		return
	}
	
	// Get game
	game, exists := games.GetGame(req.Game)
	if !exists {
		s.writeError(w, http.StatusBadRequest, ErrTypeGameNotFound, fmt.Sprintf("Game '%s' not found", req.Game), map[string]interface{}{
			"available_games": games.ListGames(),
		})
		return
	}
	
	// Log verify request (without sensitive data)
	serverHash := hashSeed(req.Seeds.Server)
	clientHash := hashSeed(req.Seeds.Client)
	log.Printf(
		"verify_request game=%s server_hash=%s client_hash=%s nonce=%d",
		req.Game, serverHash, clientHash, req.Nonce,
	)
	
	// Evaluate the game for this specific nonce
	gameResult, err := game.Evaluate(req.Seeds, req.Nonce, req.Params)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, ErrTypeInternal, "Game evaluation failed", map[string]interface{}{
			"game":  req.Game,
			"nonce": req.Nonce,
			"error": err.Error(),
		})
		return
	}
	
	// Create response with full debugging information
	response := VerifyResponse{
		Nonce:         req.Nonce,
		GameResult:    gameResult,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log successful verification
	log.Printf(
		"verify_completed game=%s nonce=%d metric=%f metric_label=%s",
		req.Game, req.Nonce, gameResult.Metric, gameResult.MetricLabel,
	)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleListGames returns available games with comprehensive metadata
func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	// Get all game specs
	gameSpecs := games.ListGames()
	
	// Log games request
	log.Printf("games_request total_games=%d", len(gameSpecs))
	
	// Create response with version information
	response := GamesResponse{
		Games:         gameSpecs,
		EngineVersion: EngineVersion,
	}
	
	// Log successful response
	log.Printf("games_completed total_games=%d", len(gameSpecs))
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleSeedHash returns SHA256 hash of server seed with security logging
func (s *Server) handleSeedHash(w http.ResponseWriter, r *http.Request) {
	var req SeedHashRequest
	
	// Parse JSON request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, "Invalid JSON format", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	
	// Validate request
	if err := ValidateSeedHashRequest(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, ErrTypeValidation, err.Error(), map[string]interface{}{
			"field_errors": err.Error(),
		})
		return
	}
	
	// Calculate SHA256 hash
	hash := sha256.Sum256([]byte(req.ServerSeed))
	hashHex := hex.EncodeToString(hash[:])
	
	// Security logging - log hash but never the raw seed
	log.Printf(
		"seed_hash_request hash=%s timestamp=%s",
		hashHex, time.Now().UTC().Format(time.RFC3339),
	)
	
	// Create response
	response := SeedHashResponse{
		Hash:          hashHex,
		EngineVersion: EngineVersion,
		Echo:          req,
	}
	
	// Log successful hash generation
	log.Printf("seed_hash_completed hash=%s", hashHex)
	
	s.writeJSON(w, http.StatusOK, response)
}