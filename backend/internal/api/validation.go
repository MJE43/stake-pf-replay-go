package api

import (
	"fmt"
	"strings"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// ValidateScanRequest validates a scan request and returns any validation errors
func ValidateScanRequest(req *ScanRequest) error {
	// Validate game
	if req.Game == "" {
		return fmt.Errorf("game is required")
	}
	
	// Check if game exists
	if _, exists := games.GetGame(req.Game); !exists {
		return fmt.Errorf("game '%s' not found", req.Game)
	}
	
	// Validate seeds
	if req.Seeds.Server == "" {
		return fmt.Errorf("server seed is required")
	}
	if req.Seeds.Client == "" {
		return fmt.Errorf("client seed is required")
	}
	
	// Validate nonce range
	if req.NonceEnd < req.NonceStart {
		return fmt.Errorf("nonce_end (%d) must be >= nonce_start (%d)", req.NonceEnd, req.NonceStart)
	}
	
	// Validate nonce range size (prevent excessive ranges)
	const maxNonceRange = 10_000_000 // 10M nonces max
	if req.NonceEnd-req.NonceStart > maxNonceRange {
		return fmt.Errorf("nonce range too large (max %d nonces)", maxNonceRange)
	}
	
	// Validate target operation
	validOps := []string{"eq", "gt", "ge", "lt", "le", "between", "outside"}
	if req.TargetOp == "" {
		return fmt.Errorf("target_op is required")
	}
	
	validOp := false
	for _, op := range validOps {
		if req.TargetOp == op {
			validOp = true
			break
		}
	}
	if !validOp {
		return fmt.Errorf("target_op must be one of: %s", strings.Join(validOps, ", "))
	}
	
	// Validate target values for range operations
	if req.TargetOp == "between" || req.TargetOp == "outside" {
		if req.TargetVal2 == 0 {
			return fmt.Errorf("target_val2 is required for '%s' operation", req.TargetOp)
		}
		if req.TargetVal > req.TargetVal2 {
			return fmt.Errorf("target_val must be <= target_val2 for '%s' operation", req.TargetOp)
		}
	}
	
	// Validate limits
	if req.Limit < 0 {
		return fmt.Errorf("limit must be >= 0")
	}
	const maxLimit = 100_000
	if req.Limit > maxLimit {
		return fmt.Errorf("limit too large (max %d)", maxLimit)
	}
	
	// Validate timeout
	if req.TimeoutMs < 0 {
		return fmt.Errorf("timeout_ms must be >= 0")
	}
	const maxTimeoutMs = 300_000 // 5 minutes
	if req.TimeoutMs > maxTimeoutMs {
		return fmt.Errorf("timeout_ms too large (max %d ms)", maxTimeoutMs)
	}
	
	// Validate tolerance
	if req.Tolerance < 0 {
		return fmt.Errorf("tolerance must be >= 0")
	}
	
	return nil
}

// ValidateVerifyRequest validates a verify request
func ValidateVerifyRequest(req *VerifyRequest) error {
	// Validate game
	if req.Game == "" {
		return fmt.Errorf("game is required")
	}
	
	// Check if game exists
	if _, exists := games.GetGame(req.Game); !exists {
		return fmt.Errorf("game '%s' not found", req.Game)
	}
	
	// Validate seeds
	if req.Seeds.Server == "" {
		return fmt.Errorf("server seed is required")
	}
	if req.Seeds.Client == "" {
		return fmt.Errorf("client seed is required")
	}
	
	return nil
}

// ValidateSeedHashRequest validates a seed hash request
func ValidateSeedHashRequest(req *SeedHashRequest) error {
	if req.ServerSeed == "" {
		return fmt.Errorf("server_seed is required")
	}
	
	return nil
}

// convertToScanRequest converts API ScanRequest to internal scan.ScanRequest
func convertToScanRequest(apiReq *ScanRequest) scan.ScanRequest {
	return scan.ScanRequest{
		Game:       apiReq.Game,
		Seeds:      apiReq.Seeds,
		NonceStart: apiReq.NonceStart,
		NonceEnd:   apiReq.NonceEnd,
		Params:     apiReq.Params,
		TargetOp:   scan.TargetOp(apiReq.TargetOp),
		TargetVal:  apiReq.TargetVal,
		TargetVal2: apiReq.TargetVal2,
		Tolerance:  apiReq.Tolerance,
		Limit:      apiReq.Limit,
		TimeoutMs:  apiReq.TimeoutMs,
	}
}