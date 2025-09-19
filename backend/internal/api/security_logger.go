package api

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// SecurityLogger handles security-conscious logging with no raw seed exposure
type SecurityLogger struct {
	logger *log.Logger
}

// NewSecurityLogger creates a new security logger
func NewSecurityLogger() *SecurityLogger {
	logger := log.New(os.Stdout, "[SECURITY] ", log.LstdFlags|log.LUTC)
	return &SecurityLogger{
		logger: logger,
	}
}

// LogScanOperation logs scan operations with security-safe parameters
func (sl *SecurityLogger) LogScanOperation(
	requestID string,
	game string,
	serverSeed string,
	clientSeed string,
	nonceStart, nonceEnd uint64,
	params map[string]any,
	targetOp string,
	targetVal float64,
	limit int,
	timeoutMs int,
) {
	serverHash := sl.hashSeed(serverSeed)
	clientHash := sl.hashSeed(clientSeed)
	
	sl.logger.Printf(
		"scan_operation request_id=%s game=%s server_hash=%s client_hash=%s nonce_range=%d-%d target_op=%s target_val=%f limit=%d timeout_ms=%d params=%+v engine_version=%s timestamp=%s",
		requestID,
		game,
		serverHash,
		clientHash,
		nonceStart,
		nonceEnd,
		targetOp,
		targetVal,
		limit,
		timeoutMs,
		sl.sanitizeParams(params),
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogVerifyOperation logs verify operations with security-safe parameters
func (sl *SecurityLogger) LogVerifyOperation(
	requestID string,
	game string,
	serverSeed string,
	clientSeed string,
	nonce uint64,
	params map[string]any,
	result games.GameResult,
) {
	serverHash := sl.hashSeed(serverSeed)
	clientHash := sl.hashSeed(clientSeed)
	
	sl.logger.Printf(
		"verify_operation request_id=%s game=%s server_hash=%s client_hash=%s nonce=%d params=%+v metric=%f metric_label=%s engine_version=%s timestamp=%s",
		requestID,
		game,
		serverHash,
		clientHash,
		nonce,
		sl.sanitizeParams(params),
		result.Metric,
		result.MetricLabel,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogSeedHashOperation logs seed hashing operations (only the hash, never the raw seed)
func (sl *SecurityLogger) LogSeedHashOperation(
	requestID string,
	serverSeed string,
	resultHash string,
) {
	// Log the hash of the input seed and the resulting hash
	inputHash := sl.hashSeed(serverSeed)
	
	sl.logger.Printf(
		"seed_hash_operation request_id=%s input_hash=%s result_hash=%s engine_version=%s timestamp=%s",
		requestID,
		inputHash,
		resultHash,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogSecurityEvent logs security-related events (failed validations, suspicious activity)
func (sl *SecurityLogger) LogSecurityEvent(
	requestID string,
	eventType string,
	description string,
	context map[string]interface{},
	remoteAddr string,
) {
	// Sanitize context to remove any sensitive data
	sanitizedContext := sl.sanitizeContext(context)
	
	sl.logger.Printf(
		"security_event request_id=%s type=%s description=%q context=%+v remote_addr=%s engine_version=%s timestamp=%s",
		requestID,
		eventType,
		description,
		sanitizedContext,
		remoteAddr,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogPerformanceMetrics logs performance-related metrics for monitoring
func (sl *SecurityLogger) LogPerformanceMetrics(
	requestID string,
	operation string,
	duration time.Duration,
	itemsProcessed uint64,
	memoryUsed uint64,
	success bool,
) {
	status := "success"
	if !success {
		status = "failure"
	}
	
	sl.logger.Printf(
		"performance_metrics request_id=%s operation=%s duration=%v items_processed=%d memory_used_bytes=%d status=%s engine_version=%s timestamp=%s",
		requestID,
		operation,
		duration,
		itemsProcessed,
		memoryUsed,
		status,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogAuditEvent logs audit events for compliance and debugging
func (sl *SecurityLogger) LogAuditEvent(
	requestID string,
	action string,
	resource string,
	outcome string,
	details map[string]interface{},
) {
	sanitizedDetails := sl.sanitizeContext(details)
	
	sl.logger.Printf(
		"audit_event request_id=%s action=%s resource=%s outcome=%s details=%+v engine_version=%s timestamp=%s",
		requestID,
		action,
		resource,
		outcome,
		sanitizedDetails,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// hashSeed creates a SHA256 hash of a seed for logging (first 16 chars for brevity)
func (sl *SecurityLogger) hashSeed(seed string) string {
	if seed == "" {
		return "empty"
	}
	hash := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(hash[:])[:16]
}

// sanitizeParams removes or hashes sensitive parameters
func (sl *SecurityLogger) sanitizeParams(params map[string]any) map[string]any {
	if params == nil {
		return nil
	}
	
	sanitized := make(map[string]any)
	for key, value := range params {
		// Check for sensitive parameter names
		switch key {
		case "server_seed", "serverSeed", "server":
			// Hash the seed instead of logging it
			if strVal, ok := value.(string); ok {
				sanitized[key+"_hash"] = sl.hashSeed(strVal)
			} else {
				sanitized[key+"_hash"] = "non_string_value"
			}
		case "client_seed", "clientSeed", "client":
			// Hash the seed instead of logging it
			if strVal, ok := value.(string); ok {
				sanitized[key+"_hash"] = sl.hashSeed(strVal)
			} else {
				sanitized[key+"_hash"] = "non_string_value"
			}
		case "private_key", "secret", "password", "token", "api_key":
			// Never log these, just indicate they were present
			sanitized[key] = "[REDACTED]"
		default:
			// Safe to log other parameters
			sanitized[key] = value
		}
	}
	
	return sanitized
}

// sanitizeContext removes sensitive data from context maps
func (sl *SecurityLogger) sanitizeContext(context map[string]interface{}) map[string]interface{} {
	if context == nil {
		return nil
	}
	
	sanitized := make(map[string]interface{})
	for key, value := range context {
		switch key {
		case "server_seed", "serverSeed", "server", "client_seed", "clientSeed", "client":
			// Hash seeds instead of logging them
			if strVal, ok := value.(string); ok {
				sanitized[key+"_hash"] = sl.hashSeed(strVal)
			} else {
				sanitized[key+"_hash"] = fmt.Sprintf("non_string_value_%T", value)
			}
		case "private_key", "secret", "password", "token", "api_key", "authorization":
			// Never log these
			sanitized[key] = "[REDACTED]"
		case "seeds":
			// Handle Seeds struct
			if seeds, ok := value.(games.Seeds); ok {
				sanitized["server_seed_hash"] = sl.hashSeed(seeds.Server)
				sanitized["client_seed_hash"] = sl.hashSeed(seeds.Client)
			} else {
				sanitized[key] = "[SEEDS_OBJECT]"
			}
		default:
			// Safe to log other context
			sanitized[key] = value
		}
	}
	
	return sanitized
}

// LogSystemStartup logs system startup information
func (sl *SecurityLogger) LogSystemStartup(port string, config map[string]interface{}) {
	sanitizedConfig := sl.sanitizeContext(config)
	
	sl.logger.Printf(
		"system_startup port=%s config=%+v engine_version=%s git_commit=%s build_time=%s timestamp=%s",
		port,
		sanitizedConfig,
		EngineVersion,
		GitCommit,
		BuildTime,
		time.Now().UTC().Format(time.RFC3339),
	)
}

// LogSystemShutdown logs system shutdown information
func (sl *SecurityLogger) LogSystemShutdown(reason string, uptime time.Duration) {
	sl.logger.Printf(
		"system_shutdown reason=%s uptime=%v engine_version=%s timestamp=%s",
		reason,
		uptime,
		EngineVersion,
		time.Now().UTC().Format(time.RFC3339),
	)
}