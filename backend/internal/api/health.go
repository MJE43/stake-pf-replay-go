package api

import (
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// HealthStatus represents the overall health status
type HealthStatus string

const (
	HealthStatusHealthy   HealthStatus = "healthy"
	HealthStatusDegraded  HealthStatus = "degraded"
	HealthStatusUnhealthy HealthStatus = "unhealthy"
)

// HealthCheckResponse represents a comprehensive health check response
type HealthCheckResponse struct {
	Status        HealthStatus           `json:"status"`
	Timestamp     string                 `json:"timestamp"`
	EngineVersion string                 `json:"engine_version"`
	GitCommit     string                 `json:"git_commit,omitempty"`
	BuildTime     string                 `json:"build_time,omitempty"`
	Uptime        string                 `json:"uptime"`
	Checks        map[string]HealthCheck `json:"checks"`
	System        SystemInfo             `json:"system"`
	RequestID     string                 `json:"request_id,omitempty"`
}

// HealthCheck represents an individual health check
type HealthCheck struct {
	Status      HealthStatus `json:"status"`
	Message     string       `json:"message,omitempty"`
	LastChecked string       `json:"last_checked"`
	Duration    string       `json:"duration,omitempty"`
}

// SystemInfo contains system information
type SystemInfo struct {
	GoVersion      string `json:"go_version"`
	NumGoroutines  int    `json:"num_goroutines"`
	NumCPU         int    `json:"num_cpu"`
	GOMAXPROCS     int    `json:"gomaxprocs"`
	MemoryAlloc    uint64 `json:"memory_alloc_bytes"`
	MemoryTotal    uint64 `json:"memory_total_bytes"`
	MemorySys      uint64 `json:"memory_sys_bytes"`
	GCCycles       uint32 `json:"gc_cycles"`
}

// MetricsResponse represents basic performance metrics
type MetricsResponse struct {
	Timestamp     string                 `json:"timestamp"`
	EngineVersion string                 `json:"engine_version"`
	Uptime        string                 `json:"uptime"`
	System        SystemInfo             `json:"system"`
	Operations    map[string]OpMetrics   `json:"operations"`
	RequestID     string                 `json:"request_id,omitempty"`
}

// OpMetrics represents operation-specific metrics
type OpMetrics struct {
	TotalRequests   uint64        `json:"total_requests"`
	SuccessRequests uint64        `json:"success_requests"`
	ErrorRequests   uint64        `json:"error_requests"`
	AvgDuration     time.Duration `json:"avg_duration_ms"`
	LastRequest     string        `json:"last_request,omitempty"`
}

// HealthMonitor manages health checks and metrics
type HealthMonitor struct {
	startTime time.Time
	metrics   map[string]*OpMetrics
}

// NewHealthMonitor creates a new health monitor
func NewHealthMonitor() *HealthMonitor {
	return &HealthMonitor{
		startTime: time.Now(),
		metrics:   make(map[string]*OpMetrics),
	}
}

// handleHealthCheck provides comprehensive health check endpoint
func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetReqID(r.Context())
	start := time.Now()
	
	// Perform health checks
	checks := make(map[string]HealthCheck)
	overallStatus := HealthStatusHealthy
	
	// Check games availability
	gameCheck := s.checkGamesHealth()
	checks["games"] = gameCheck
	if gameCheck.Status != HealthStatusHealthy {
		overallStatus = HealthStatusDegraded
	}
	
	// Check database connectivity
	dbCheck := s.checkDatabaseHealth()
	checks["database"] = dbCheck
	if dbCheck.Status == HealthStatusUnhealthy {
		overallStatus = HealthStatusUnhealthy
	} else if dbCheck.Status == HealthStatusDegraded && overallStatus == HealthStatusHealthy {
		overallStatus = HealthStatusDegraded
	}
	
	// Check scanner functionality
	scannerCheck := s.checkScannerHealth()
	checks["scanner"] = scannerCheck
	if scannerCheck.Status != HealthStatusHealthy {
		if scannerCheck.Status == HealthStatusUnhealthy {
			overallStatus = HealthStatusUnhealthy
		} else if overallStatus == HealthStatusHealthy {
			overallStatus = HealthStatusDegraded
		}
	}
	
	// Get system information
	systemInfo := s.getSystemInfo()
	
	// Create response
	response := HealthCheckResponse{
		Status:        overallStatus,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		EngineVersion: EngineVersion,
		GitCommit:     GitCommit,
		BuildTime:     BuildTime,
		Uptime:        time.Since(s.getStartTime()).String(),
		Checks:        checks,
		System:        systemInfo,
		RequestID:     requestID,
	}
	
	// Determine HTTP status code based on health
	statusCode := http.StatusOK
	if overallStatus == HealthStatusDegraded {
		statusCode = http.StatusOK // Still OK, but with warnings
	} else if overallStatus == HealthStatusUnhealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	// Log health check
	duration := time.Since(start)
	s.securityLogger.LogAuditEvent(
		requestID,
		"health_check",
		"system",
		string(overallStatus),
		map[string]interface{}{
			"duration":    duration,
			"checks":      len(checks),
			"status_code": statusCode,
		},
	)
	
	s.writeJSON(w, statusCode, response)
}

// handleMetrics provides basic performance metrics endpoint
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetReqID(r.Context())
	
	// Get system information
	systemInfo := s.getSystemInfo()
	
	// Create metrics response (placeholder - would be populated with real metrics)
	response := MetricsResponse{
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		EngineVersion: EngineVersion,
		Uptime:        time.Since(s.getStartTime()).String(),
		System:        systemInfo,
		Operations:    make(map[string]OpMetrics), // Would be populated with real metrics
		RequestID:     requestID,
	}
	
	// Log metrics request
	s.securityLogger.LogAuditEvent(
		requestID,
		"metrics_request",
		"system",
		"success",
		map[string]interface{}{
			"num_goroutines": systemInfo.NumGoroutines,
			"memory_alloc":   systemInfo.MemoryAlloc,
		},
	)
	
	s.writeJSON(w, http.StatusOK, response)
}

// handleReadiness provides readiness probe endpoint
func (s *Server) handleReadiness(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetReqID(r.Context())
	
	// Simple readiness check - ensure critical components are available
	ready := true
	message := "Ready"
	
	// Check if games are loaded
	gameSpecs := games.ListGames()
	if len(gameSpecs) == 0 {
		ready = false
		message = "No games available"
	}
	
	// Check scanner
	if s.scanner == nil {
		ready = false
		message = "Scanner not initialized"
	}
	
	response := map[string]interface{}{
		"ready":          ready,
		"message":        message,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"engine_version": EngineVersion,
		"request_id":     requestID,
	}
	
	statusCode := http.StatusOK
	if !ready {
		statusCode = http.StatusServiceUnavailable
	}
	
	// Log readiness check
	outcome := "ready"
	if !ready {
		outcome = "not_ready"
	}
	s.securityLogger.LogAuditEvent(
		requestID,
		"readiness_check",
		"system",
		outcome,
		map[string]interface{}{
			"message":     message,
			"games_count": len(gameSpecs),
		},
	)
	
	s.writeJSON(w, statusCode, response)
}

// handleLiveness provides liveness probe endpoint
func (s *Server) handleLiveness(w http.ResponseWriter, r *http.Request) {
	requestID := middleware.GetReqID(r.Context())
	
	// Simple liveness check - just respond if the server is running
	response := map[string]interface{}{
		"alive":          true,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"engine_version": EngineVersion,
		"uptime":         time.Since(s.getStartTime()).String(),
		"request_id":     requestID,
	}
	
	s.writeJSON(w, http.StatusOK, response)
}

// checkGamesHealth checks if games are properly loaded and functional
func (s *Server) checkGamesHealth() HealthCheck {
	start := time.Now()
	
	gameSpecs := games.ListGames()
	status := HealthStatusHealthy
	message := fmt.Sprintf("%d games available", len(gameSpecs))
	
	if len(gameSpecs) == 0 {
		status = HealthStatusUnhealthy
		message = "No games available"
	} else if len(gameSpecs) < 3 { // Expecting at least limbo, dice, roulette
		status = HealthStatusDegraded
		message = fmt.Sprintf("Only %d games available (expected 3+)", len(gameSpecs))
	}
	
	return HealthCheck{
		Status:      status,
		Message:     message,
		LastChecked: time.Now().UTC().Format(time.RFC3339),
		Duration:    time.Since(start).String(),
	}
}

// checkDatabaseHealth checks database connectivity
func (s *Server) checkDatabaseHealth() HealthCheck {
	start := time.Now()
	
	// Simple database health check
	status := HealthStatusHealthy
	message := "Database connection healthy"
	
	if s.db == nil {
		status = HealthStatusUnhealthy
		message = "Database not initialized"
	} else {
		// Could add actual database ping here
		// For now, just check if it's not nil
	}
	
	return HealthCheck{
		Status:      status,
		Message:     message,
		LastChecked: time.Now().UTC().Format(time.RFC3339),
		Duration:    time.Since(start).String(),
	}
}

// checkScannerHealth checks scanner functionality
func (s *Server) checkScannerHealth() HealthCheck {
	start := time.Now()
	
	status := HealthStatusHealthy
	message := "Scanner healthy"
	
	if s.scanner == nil {
		status = HealthStatusUnhealthy
		message = "Scanner not initialized"
	}
	
	return HealthCheck{
		Status:      status,
		Message:     message,
		LastChecked: time.Now().UTC().Format(time.RFC3339),
		Duration:    time.Since(start).String(),
	}
}

// getSystemInfo collects system information
func (s *Server) getSystemInfo() SystemInfo {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return SystemInfo{
		GoVersion:     runtime.Version(),
		NumGoroutines: runtime.NumGoroutine(),
		NumCPU:        runtime.NumCPU(),
		GOMAXPROCS:    runtime.GOMAXPROCS(0),
		MemoryAlloc:   m.Alloc,
		MemoryTotal:   m.TotalAlloc,
		MemorySys:     m.Sys,
		GCCycles:      m.NumGC,
	}
}

// getStartTime returns the server start time
func (s *Server) getStartTime() time.Time {
	return s.startTime
}