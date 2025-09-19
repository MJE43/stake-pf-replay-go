package scan

import (
	"context"
	"testing"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// TestScanningIntegration demonstrates the complete scanning workflow
func TestScanningIntegration(t *testing.T) {
	scanner := NewScanner()
	
	// Test scanning for high Limbo multipliers
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "server_seed_example", Client: "client_seed_example"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  5.0, // Looking for 5x+ multipliers
		Tolerance:  1e-9,
		Limit:      50, // Limit to first 50 hits
		TimeoutMs:  5000, // 5 second timeout
	}

	ctx := context.Background()
	result, err := scanner.Scan(ctx, req)
	
	if err != nil {
		t.Fatalf("Scan failed: %v", err)
	}

	t.Logf("Scan Results:")
	t.Logf("  Total Evaluated: %d", result.Summary.TotalEvaluated)
	t.Logf("  Hits Found: %d", result.Summary.HitsFound)
	t.Logf("  Min Metric: %.2f", result.Summary.MinMetric)
	t.Logf("  Max Metric: %.2f", result.Summary.MaxMetric)
	t.Logf("  Mean Metric: %.2f", result.Summary.MeanMetric)
	t.Logf("  Timed Out: %v", result.Summary.TimedOut)
	t.Logf("  Engine Version: %s", result.EngineVersion)

	// Verify basic properties
	if result.Summary.TotalEvaluated == 0 {
		t.Error("No evaluations performed")
	}

	if len(result.Hits) > req.Limit {
		t.Errorf("Too many hits returned: %d > %d", len(result.Hits), req.Limit)
	}

	// Verify all hits meet the criteria
	for i, hit := range result.Hits {
		if hit.Metric < req.TargetVal {
			t.Errorf("Hit %d has metric %.2f which is below target %.2f", i, hit.Metric, req.TargetVal)
		}
	}

	// Verify echo
	if result.Echo.Game != req.Game {
		t.Errorf("Echo mismatch: expected %s, got %s", req.Game, result.Echo.Game)
	}
}

// TestScanningBetweenOperation tests the "between" target operation
func TestScanningBetweenOperation(t *testing.T) {
	scanner := NewScanner()
	
	req := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   1000,
		Params:     map[string]any{},
		TargetOp:   OpBetween,
		TargetVal:  45.0, // Between 45 and 55
		TargetVal2: 55.0,
		Tolerance:  1e-9,
		Limit:      20,
	}

	ctx := context.Background()
	result, err := scanner.Scan(ctx, req)
	
	if err != nil {
		t.Fatalf("Scan failed: %v", err)
	}

	// Verify all hits are within the range
	for i, hit := range result.Hits {
		if hit.Metric < req.TargetVal || hit.Metric > req.TargetVal2 {
			t.Errorf("Hit %d has metric %.2f which is outside range [%.2f, %.2f]", 
				i, hit.Metric, req.TargetVal, req.TargetVal2)
		}
	}

	t.Logf("Found %d dice rolls between %.1f and %.1f", len(result.Hits), req.TargetVal, req.TargetVal2)
}

// TestScanningRouletteExactMatch tests exact matching for roulette
func TestScanningRouletteExactMatch(t *testing.T) {
	scanner := NewScanner()
	
	req := ScanRequest{
		Game:       "roulette",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   1000,
		Params:     map[string]any{},
		TargetOp:   OpEqual,
		TargetVal:  17.0, // Looking for pocket 17
		Tolerance:  0,    // Exact matching
		Limit:      10,
	}

	ctx := context.Background()
	result, err := scanner.Scan(ctx, req)
	
	if err != nil {
		t.Fatalf("Scan failed: %v", err)
	}

	// Verify all hits are exactly 17
	for i, hit := range result.Hits {
		if hit.Metric != 17.0 {
			t.Errorf("Hit %d has metric %.0f, expected exactly 17", i, hit.Metric)
		}
	}

	t.Logf("Found %d occurrences of roulette pocket 17", len(result.Hits))
}