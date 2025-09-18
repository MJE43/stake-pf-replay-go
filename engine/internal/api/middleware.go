package api

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// SecurityLoggingMiddleware logs requests without exposing sensitive data
func (s *Server) SecurityLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := middleware.GetReqID(r.Context())
		
		// Create a response writer wrapper to capture status code
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		
		// Log request start (without sensitive data)
		s.logger.Printf(
			"request_start method=%s path=%s request_id=%s remote_addr=%s user_agent=%q engine_version=%s",
			r.Method,
			r.URL.Path,
			requestID,
			r.RemoteAddr,
			r.UserAgent(),
			EngineVersion,
		)
		
		// Process request
		next.ServeHTTP(ww, r)
		
		// Log request completion (without sensitive data)
		duration := time.Since(start)
		s.logger.Printf(
			"request_completed method=%s path=%s status=%d duration=%v request_id=%s bytes_written=%d engine_version=%s",
			r.Method,
			r.URL.Path,
			ww.Status(),
			duration,
			requestID,
			ww.BytesWritten(),
			EngineVersion,
		)
	})
}

// CORSMiddleware handles CORS headers for development
func (s *Server) CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// hashSeed creates a SHA256 hash of a seed for logging purposes
func hashSeed(seed string) string {
	if seed == "" {
		return "empty"
	}
	hash := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(hash[:])[:16] // First 16 chars for brevity
}