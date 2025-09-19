package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// writeJSONError writes JSON error response
func writeJSONError(w http.ResponseWriter, data interface{}) error {
	return json.NewEncoder(w).Encode(data)
}

// ErrorBuilder helps construct structured errors with context
type ErrorBuilder struct {
	errType   string
	message   string
	context   map[string]interface{}
	requestID string
	cause     error
}

// NewError creates a new error builder
func NewError(errType, message string) *ErrorBuilder {
	return &ErrorBuilder{
		errType: errType,
		message: message,
		context: make(map[string]interface{}),
	}
}

// WithContext adds context information to the error
func (eb *ErrorBuilder) WithContext(key string, value interface{}) *ErrorBuilder {
	eb.context[key] = value
	return eb
}

// WithRequestID adds request ID to the error
func (eb *ErrorBuilder) WithRequestID(requestID string) *ErrorBuilder {
	eb.requestID = requestID
	return eb
}

// WithCause adds the underlying cause error
func (eb *ErrorBuilder) WithCause(err error) *ErrorBuilder {
	eb.cause = err
	if err != nil {
		eb.context["cause"] = err.Error()
	}
	return eb
}

// Build creates the final EngineError
func (eb *ErrorBuilder) Build() EngineError {
	return EngineError{
		Type:      eb.errType,
		Message:   eb.message,
		Context:   eb.context,
		RequestID: eb.requestID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}

// ErrorHandler provides centralized error handling with logging
type ErrorHandler struct {
	logger         *log.Logger
	securityLogger *SecurityLogger
}

// NewErrorHandler creates a new error handler
func NewErrorHandler(logger *log.Logger) *ErrorHandler {
	return &ErrorHandler{
		logger:         logger,
		securityLogger: NewSecurityLogger(),
	}
}

// HandleError processes an error and writes appropriate HTTP response
func (eh *ErrorHandler) HandleError(w http.ResponseWriter, r *http.Request, err error, defaultStatus int) {
	requestID := middleware.GetReqID(r.Context())
	
	// Check if it's already an EngineError
	if engineErr, ok := err.(EngineError); ok {
		eh.logError(r, engineErr, defaultStatus)
		eh.writeErrorResponse(w, defaultStatus, engineErr)
		return
	}
	
	// Convert regular error to EngineError
	engineErr := NewError(ErrTypeInternal, err.Error()).
		WithRequestID(requestID).
		WithContext("path", r.URL.Path).
		WithContext("method", r.Method).
		Build()
	
	eh.logError(r, engineErr, defaultStatus)
	eh.writeErrorResponse(w, defaultStatus, engineErr)
}

// HandleValidationError handles validation-specific errors
func (eh *ErrorHandler) HandleValidationError(w http.ResponseWriter, r *http.Request, field, message string) {
	requestID := middleware.GetReqID(r.Context())
	
	engineErr := NewError(ErrTypeValidation, fmt.Sprintf("Validation failed: %s", message)).
		WithRequestID(requestID).
		WithContext("field", field).
		WithContext("path", r.URL.Path).
		WithContext("method", r.Method).
		Build()
	
	// Log security event for validation failure
	eh.securityLogger.LogSecurityEvent(
		requestID,
		"validation_failure",
		message,
		map[string]interface{}{
			"field": field,
			"path":  r.URL.Path,
		},
		r.RemoteAddr,
	)
	
	eh.logError(r, engineErr, http.StatusBadRequest)
	eh.writeErrorResponse(w, http.StatusBadRequest, engineErr)
}

// HandleGameError handles game-specific errors
func (eh *ErrorHandler) HandleGameError(w http.ResponseWriter, r *http.Request, game string, nonce uint64, err error) {
	requestID := middleware.GetReqID(r.Context())
	
	engineErr := NewError(ErrTypeGameEvaluation, "Game evaluation failed").
		WithRequestID(requestID).
		WithContext("game", game).
		WithContext("nonce", nonce).
		WithContext("path", r.URL.Path).
		WithCause(err).
		Build()
	
	eh.logError(r, engineErr, http.StatusInternalServerError)
	eh.writeErrorResponse(w, http.StatusInternalServerError, engineErr)
}

// HandleTimeoutError handles timeout-specific errors
func (eh *ErrorHandler) HandleTimeoutError(w http.ResponseWriter, r *http.Request, operation string, timeoutMs int) {
	requestID := middleware.GetReqID(r.Context())
	
	engineErr := NewError(ErrTypeTimeout, fmt.Sprintf("Operation timed out: %s", operation)).
		WithRequestID(requestID).
		WithContext("operation", operation).
		WithContext("timeout_ms", timeoutMs).
		WithContext("path", r.URL.Path).
		Build()
	
	eh.logError(r, engineErr, http.StatusRequestTimeout)
	eh.writeErrorResponse(w, http.StatusRequestTimeout, engineErr)
}

// logError logs the error with appropriate level and context
func (eh *ErrorHandler) logError(r *http.Request, engineErr EngineError, status int) {
	category := GetErrorCategory(engineErr.Type)
	
	// Log with different levels based on error category
	logLevel := "ERROR"
	if category == CategoryValidation {
		logLevel = "WARN"
	} else if status >= 500 {
		logLevel = "ERROR"
	}
	
	// Create structured log entry
	logFields := map[string]interface{}{
		"level":      logLevel,
		"type":       engineErr.Type,
		"category":   category,
		"message":    engineErr.Message,
		"status":     status,
		"request_id": engineErr.RequestID,
		"timestamp":  engineErr.Timestamp,
		"method":     r.Method,
		"path":       r.URL.Path,
		"remote_ip":  r.RemoteAddr,
	}
	
	// Add context fields (but filter sensitive data)
	for key, value := range engineErr.Context {
		// Never log raw seeds - only hashes
		if key == "server_seed" || key == "client_seed" {
			continue
		}
		logFields[key] = value
	}
	
	// Log the structured error
	eh.logger.Printf(
		"error_occurred level=%s type=%s category=%s status=%d request_id=%s path=%s message=%q context=%+v",
		logLevel, engineErr.Type, category, status, engineErr.RequestID, r.URL.Path, engineErr.Message, logFields,
	)
}

// writeErrorResponse writes the error response as JSON
func (eh *ErrorHandler) writeErrorResponse(w http.ResponseWriter, status int, engineErr EngineError) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Engine-Version", EngineVersion)
	w.Header().Set("X-Error-Type", engineErr.Type)
	w.Header().Set("X-Error-Category", string(GetErrorCategory(engineErr.Type)))
	w.WriteHeader(status)
	
	// Write JSON response
	if err := writeJSONError(w, engineErr); err != nil {
		// Fallback to plain text if JSON encoding fails
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// RecoveryHandler provides panic recovery with structured error logging
func (eh *ErrorHandler) RecoveryHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				requestID := middleware.GetReqID(r.Context())
				
				// Log panic with full context
				eh.logger.Printf(
					"panic_recovered request_id=%s path=%s method=%s panic=%v",
					requestID, r.URL.Path, r.Method, rvr,
				)
				
				// Create structured error response
				engineErr := NewError(ErrTypeInternal, "Internal server error").
					WithRequestID(requestID).
					WithContext("panic", fmt.Sprintf("%v", rvr)).
					WithContext("path", r.URL.Path).
					WithContext("method", r.Method).
					Build()
				
				eh.writeErrorResponse(w, http.StatusInternalServerError, engineErr)
			}
		}()
		
		next.ServeHTTP(w, r)
	})
}

// ContextTimeoutHandler handles context timeout errors
func (eh *ErrorHandler) ContextTimeoutHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, operation string) bool {
	select {
	case <-ctx.Done():
		if ctx.Err() == context.DeadlineExceeded {
			eh.HandleTimeoutError(w, r, operation, 0) // timeout value unknown here
			return true
		}
		return false
	default:
		return false
	}
}