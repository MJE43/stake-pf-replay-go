package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// handleScan processes scan requests
func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	var req scan.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	
	// Validate request
	if req.Game == "" {
		s.writeError(w, http.StatusBadRequest, "Game is required")
		return
	}
	
	if req.ServerSeed == "" || req.ClientSeed == "" {
		s.writeError(w, http.StatusBadRequest, "Server seed and client seed are required")
		return
	}
	
	if req.NonceEnd < req.NonceStart {
		s.writeError(w, http.StatusBadRequest, "Invalid nonce range")
		return
	}
	
	// Set defaults
	if req.Tolerance == 0 {
		req.Tolerance = 1e-9
	}
	
	// Perform scan
	result, err := s.scanner.Scan(r.Context(), req)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	
	s.writeJSON(w, http.StatusOK, result)
}

// handleVerify verifies a single nonce
func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Game       string `json:"game"`
		ServerSeed string `json:"server_seed"`
		ClientSeed string `json:"client_seed"`
		Nonce      uint64 `json:"nonce"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	
	// Get game
	game, exists := games.GetGame(req.Game)
	if !exists {
		s.writeError(w, http.StatusBadRequest, "Game not found")
		return
	}
	
	// Generate floats and evaluate
	floats := engine.GenerateFloats(req.ServerSeed, req.ClientSeed, req.Nonce, 0, game.FloatsNeeded())
	metric, details := game.Evaluate(floats)
	
	result := map[string]interface{}{
		"nonce":          req.Nonce,
		"metric":         metric,
		"details":        details,
		"engine_version": "go-1.0.0",
	}
	
	s.writeJSON(w, http.StatusOK, result)
}

// handleListGames returns available games
func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	gameList := make([]map[string]interface{}, 0)
	
	for _, name := range games.ListGames() {
		game, _ := games.GetGame(name)
		gameList = append(gameList, map[string]interface{}{
			"name":          game.Name(),
			"metric_name":   game.MetricName(),
			"floats_needed": game.FloatsNeeded(),
		})
	}
	
	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"games": gameList,
	})
}

// handleSeedHash returns SHA256 hash of server seed
func (s *Server) handleSeedHash(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ServerSeed string `json:"server_seed"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	
	if req.ServerSeed == "" {
		s.writeError(w, http.StatusBadRequest, "Server seed is required")
		return
	}
	
	hash := sha256.Sum256([]byte(req.ServerSeed))
	hashHex := hex.EncodeToString(hash[:])
	
	s.writeJSON(w, http.StatusOK, map[string]string{
		"server_seed": req.ServerSeed,
		"hash":        hashHex,
	})
}