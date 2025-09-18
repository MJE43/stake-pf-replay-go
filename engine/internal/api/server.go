package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
	"github.com/MJE43/stake-pf-replay-go/internal/store"
)

// Server handles HTTP requests
type Server struct {
	db             store.DB
	scanner        *scan.Scanner
	errorHandler   *ErrorHandler
	logger         *log.Logger
	securityLogger *SecurityLogger
	startTime      time.Time
}

// NewServer creates a new API server
func NewServer(db store.DB) *Server {
	logger := log.New(os.Stdout, "[API] ", log.LstdFlags|log.Lshortfile)
	errorHandler := NewErrorHandler(logger)
	securityLogger := NewSecurityLogger()
	
	server := &Server{
		db:             db,
		scanner:        scan.NewScanner(),
		errorHandler:   errorHandler,
		logger:         logger,
		securityLogger: securityLogger,
		startTime:      time.Now(),
	}
	
	// Log server startup
	securityLogger.LogSystemStartup("unknown", map[string]interface{}{
		"games_available": len(games.ListGames()),
		"scanner_enabled": server.scanner != nil,
		"database_enabled": server.db != nil,
	})
	
	return server
}

// Routes sets up the HTTP routes with proper middleware
func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	
	// Core middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(s.SecurityLoggingMiddleware)
	r.Use(s.errorHandler.RecoveryHandler) // Use our custom recovery handler
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(s.CORSMiddleware)
	
	// Health and monitoring endpoints
	r.Get("/health", s.handleHealthCheck)
	r.Get("/health/ready", s.handleReadiness)
	r.Get("/health/live", s.handleLiveness)
	r.Get("/metrics", s.handleMetrics)
	
	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/scan", s.handleScan)
		r.Post("/verify", s.handleVerify)
		r.Get("/games", s.handleListGames)
		r.Post("/seed/hash", s.handleSeedHash)
	})
	
	// Legacy routes (without /api/v1 prefix for backward compatibility)
	r.Post("/scan", s.handleScan)
	r.Post("/verify", s.handleVerify)
	r.Get("/games", s.handleListGames)
	r.Post("/seed/hash", s.handleSeedHash)
	
	return r
}

// writeJSON writes a JSON response with proper headers
func (s *Server) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Engine-Version", EngineVersion)
	w.WriteHeader(status)
	
	if err := json.NewEncoder(w).Encode(data); err != nil {
		// If encoding fails, try to write a simple error response
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// writeError writes a structured error response
func (s *Server) writeError(w http.ResponseWriter, status int, errType, message string, context map[string]interface{}) {
	errorResponse := EngineError{
		Type:    errType,
		Message: message,
		Context: context,
	}
	s.writeJSON(w, status, errorResponse)
}

// writeSimpleError writes a simple error response (for backward compatibility)
func (s *Server) writeSimpleError(w http.ResponseWriter, status int, message string) {
	s.writeError(w, status, ErrTypeInternal, message, nil)
}