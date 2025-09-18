package games

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

type LimboTestVector struct {
	Description        string  `json:"description"`
	ServerSeed         string  `json:"server_seed"`
	ClientSeed         string  `json:"client_seed"`
	Nonce              uint64  `json:"nonce"`
	ExpectedMultiplier float64 `json:"expected_multiplier"`
}

func TestLimboGame(t *testing.T) {
	game := &LimboGame{}
	
	// Test basic properties
	if game.Name() != "limbo" {
		t.Errorf("Expected name 'limbo', got '%s'", game.Name())
	}
	
	if game.MetricName() != "multiplier" {
		t.Errorf("Expected metric name 'multiplier', got '%s'", game.MetricName())
	}
	
	if game.FloatsNeeded() != 1 {
		t.Errorf("Expected 1 float needed, got %d", game.FloatsNeeded())
	}
}

func TestLimboEvaluation(t *testing.T) {
	game := &LimboGame{}
	
	// Test with known float values
	testCases := []struct {
		float    float64
		minMult  float64
		maxMult  float64
	}{
		{0.5, 1.0, 3.0},    // Mid-range float
		{0.99, 1.0, 2.0},   // High float (low multiplier)
		{0.01, 10.0, 100.0}, // Low float (high multiplier)
	}
	
	for _, tc := range testCases {
		t.Run("", func(t *testing.T) {
			metric, details := game.Evaluate([]float64{tc.float})
			
			if metric < tc.minMult || metric > tc.maxMult {
				t.Errorf("Multiplier %f not in expected range [%f, %f]", metric, tc.minMult, tc.maxMult)
			}
			
			// Check details structure
			detailsMap, ok := details.(map[string]interface{})
			if !ok {
				t.Error("Details should be a map")
			}
			
			if _, exists := detailsMap["crash_point"]; !exists {
				t.Error("Details should contain crash_point")
			}
		})
	}
}

func TestLimboGoldenVectors(t *testing.T) {
	// Load test vectors
	vectorPath := filepath.Join("..", "..", "testdata", "limbo_vectors.json")
	data, err := os.ReadFile(vectorPath)
	if err != nil {
		t.Skip("Golden vectors file not found, skipping test")
		return
	}
	
	var vectors []LimboTestVector
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatalf("Failed to parse test vectors: %v", err)
	}
	
	game := &LimboGame{}
	
	for _, vector := range vectors {
		t.Run(vector.Description, func(t *testing.T) {
			// Generate floats using the same method as the scanner
			floats := engine.GenerateFloats(vector.ServerSeed, vector.ClientSeed, vector.Nonce, 0, 1)
			
			// Evaluate game
			metric, _ := game.Evaluate(floats)
			
			// Check if result matches expected (with small tolerance for floating point)
			tolerance := 0.01
			if abs(metric-vector.ExpectedMultiplier) > tolerance {
				t.Errorf("Expected multiplier %f, got %f (diff: %f)", 
					vector.ExpectedMultiplier, metric, abs(metric-vector.ExpectedMultiplier))
			}
		})
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}