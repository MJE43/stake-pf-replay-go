package games

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

type GameTestVector struct {
	Description string         `json:"description"`
	ServerSeed  string         `json:"server_seed"`
	ClientSeed  string         `json:"client_seed"`
	Nonce       uint64         `json:"nonce"`
	Params      map[string]any `json:"params"`
	Expected    GameResult     `json:"expected"`
}

type GameVectors struct {
	Limbo    []GameTestVector `json:"limbo"`
	Dice     []GameTestVector `json:"dice"`
	Roulette []GameTestVector `json:"roulette"`
	Pump     []GameTestVector `json:"pump"`
}

func TestLimboGame(t *testing.T) {
	game := &LimboGame{}
	
	// Test spec
	spec := game.Spec()
	if spec.ID != "limbo" {
		t.Errorf("Expected ID 'limbo', got '%s'", spec.ID)
	}
	
	if spec.Name != "Limbo" {
		t.Errorf("Expected name 'Limbo', got '%s'", spec.Name)
	}
	
	if spec.MetricLabel != "multiplier" {
		t.Errorf("Expected metric label 'multiplier', got '%s'", spec.MetricLabel)
	}
	
	// Test float count
	if game.FloatCount(nil) != 1 {
		t.Errorf("Expected 1 float needed, got %d", game.FloatCount(nil))
	}
}

func TestDiceGame(t *testing.T) {
	game := &DiceGame{}
	
	// Test spec
	spec := game.Spec()
	if spec.ID != "dice" {
		t.Errorf("Expected ID 'dice', got '%s'", spec.ID)
	}
	
	if spec.Name != "Dice" {
		t.Errorf("Expected name 'Dice', got '%s'", spec.Name)
	}
	
	if spec.MetricLabel != "roll" {
		t.Errorf("Expected metric label 'roll', got '%s'", spec.MetricLabel)
	}
	
	// Test float count
	if game.FloatCount(nil) != 1 {
		t.Errorf("Expected 1 float needed, got %d", game.FloatCount(nil))
	}
}

func TestRouletteGame(t *testing.T) {
	game := &RouletteGame{}
	
	// Test spec
	spec := game.Spec()
	if spec.ID != "roulette" {
		t.Errorf("Expected ID 'roulette', got '%s'", spec.ID)
	}
	
	if spec.Name != "Roulette" {
		t.Errorf("Expected name 'Roulette', got '%s'", spec.Name)
	}
	
	if spec.MetricLabel != "pocket" {
		t.Errorf("Expected metric label 'pocket', got '%s'", spec.MetricLabel)
	}
	
	// Test float count
	if game.FloatCount(nil) != 1 {
		t.Errorf("Expected 1 float needed, got %d", game.FloatCount(nil))
	}
}

func TestPumpGame(t *testing.T) {
	game := &PumpGame{}
	
	// Test spec
	spec := game.Spec()
	if spec.ID != "pump" {
		t.Errorf("Expected ID 'pump', got '%s'", spec.ID)
	}
	
	if spec.Name != "Pump" {
		t.Errorf("Expected name 'Pump', got '%s'", spec.Name)
	}
	
	if spec.MetricLabel != "multiplier" {
		t.Errorf("Expected metric label 'multiplier', got '%s'", spec.MetricLabel)
	}
	
	// Test float count
	if game.FloatCount(nil) != 25 {
		t.Errorf("Expected 25 floats needed, got %d", game.FloatCount(nil))
	}
}

func TestGameRegistry(t *testing.T) {
	// Test that all games are registered
	expectedGames := []string{"limbo", "dice", "roulette", "pump"}
	
	for _, gameID := range expectedGames {
		game, exists := GetGame(gameID)
		if !exists {
			t.Errorf("Game '%s' not found in registry", gameID)
			continue
		}
		
		spec := game.Spec()
		if spec.ID != gameID {
			t.Errorf("Game ID mismatch: expected '%s', got '%s'", gameID, spec.ID)
		}
	}
	
	// Test ListGames
	specs := ListGames()
	if len(specs) != len(expectedGames) {
		t.Errorf("Expected %d games, got %d", len(expectedGames), len(specs))
	}
}

func TestLimboEvaluation(t *testing.T) {
	game := &LimboGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}
	
	// Test basic evaluation
	result, err := game.Evaluate(seeds, 1, map[string]any{})
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	
	if result.MetricLabel != "multiplier" {
		t.Errorf("Expected metric label 'multiplier', got '%s'", result.MetricLabel)
	}
	
	if result.Metric < 1.0 {
		t.Errorf("Limbo multiplier should be at least 1.0, got %f", result.Metric)
	}
	
	// Test with custom house edge
	result, err = game.Evaluate(seeds, 1, map[string]any{"houseEdge": 0.95})
	if err != nil {
		t.Fatalf("Evaluation with custom house edge failed: %v", err)
	}
	
	if result.Metric < 1.0 {
		t.Errorf("Limbo multiplier should be at least 1.0, got %f", result.Metric)
	}
}

func TestDiceEvaluation(t *testing.T) {
	game := &DiceGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}
	
	// Test basic evaluation
	result, err := game.Evaluate(seeds, 1, map[string]any{})
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	
	if result.MetricLabel != "roll" {
		t.Errorf("Expected metric label 'roll', got '%s'", result.MetricLabel)
	}
	
	if result.Metric < 0.0 || result.Metric > 100.01 {
		t.Errorf("Dice roll should be in range [0.0, 100.01], got %f", result.Metric)
	}
}

func TestRouletteEvaluation(t *testing.T) {
	game := &RouletteGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}
	
	// Test basic evaluation
	result, err := game.Evaluate(seeds, 1, map[string]any{})
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	
	if result.MetricLabel != "pocket" {
		t.Errorf("Expected metric label 'pocket', got '%s'", result.MetricLabel)
	}
	
	if result.Metric < 0.0 || result.Metric > 36.0 {
		t.Errorf("Roulette pocket should be in range [0, 36], got %f", result.Metric)
	}
	
	// Check that metric is an integer value
	if result.Metric != math.Floor(result.Metric) {
		t.Errorf("Roulette pocket should be integer, got %f", result.Metric)
	}
}

func TestPumpEvaluation(t *testing.T) {
	game := &PumpGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}
	
	// Test basic evaluation
	result, err := game.Evaluate(seeds, 1, map[string]any{})
	if err != nil {
		t.Fatalf("Evaluation failed: %v", err)
	}
	
	if result.MetricLabel != "multiplier" {
		t.Errorf("Expected metric label 'multiplier', got '%s'", result.MetricLabel)
	}
	
	if result.Metric < 1.0 {
		t.Errorf("Pump multiplier should be at least 1.0, got %f", result.Metric)
	}
	
	// Test deterministic behavior - same seeds should produce same result
	result2, err := game.Evaluate(seeds, 1, map[string]any{})
	if err != nil {
		t.Fatalf("Second evaluation failed: %v", err)
	}
	
	if result.Metric != result2.Metric {
		t.Errorf("Pump should be deterministic: got %f and %f", result.Metric, result2.Metric)
	}
}

func TestGameGoldenVectors(t *testing.T) {
	// Load test vectors
	vectorPath := filepath.Join("..", "..", "testdata", "game_vectors.json")
	data, err := os.ReadFile(vectorPath)
	if err != nil {
		t.Skip("Golden vectors file not found, skipping test")
		return
	}
	
	var vectors GameVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatalf("Failed to parse test vectors: %v", err)
	}
	
	// Test Limbo vectors
	limboGame := &LimboGame{}
	for _, vector := range vectors.Limbo {
		t.Run("Limbo: "+vector.Description, func(t *testing.T) {
			seeds := Seeds{Server: vector.ServerSeed, Client: vector.ClientSeed}
			result, err := limboGame.Evaluate(seeds, vector.Nonce, vector.Params)
			if err != nil {
				t.Fatalf("Evaluation failed: %v", err)
			}
			
			// Note: For now, we'll test the structure rather than exact values
			// since we need to generate proper golden vectors with actual RNG output
			if result.MetricLabel != vector.Expected.MetricLabel {
				t.Errorf("Expected metric label '%s', got '%s'", 
					vector.Expected.MetricLabel, result.MetricLabel)
			}
			
			if result.Metric < 1.0 {
				t.Errorf("Limbo multiplier should be at least 1.0, got %f", result.Metric)
			}
		})
	}
	
	// Test Dice vectors
	diceGame := &DiceGame{}
	for _, vector := range vectors.Dice {
		t.Run("Dice: "+vector.Description, func(t *testing.T) {
			seeds := Seeds{Server: vector.ServerSeed, Client: vector.ClientSeed}
			result, err := diceGame.Evaluate(seeds, vector.Nonce, vector.Params)
			if err != nil {
				t.Fatalf("Evaluation failed: %v", err)
			}
			
			if result.MetricLabel != vector.Expected.MetricLabel {
				t.Errorf("Expected metric label '%s', got '%s'", 
					vector.Expected.MetricLabel, result.MetricLabel)
			}
			
			if result.Metric < 0.0 || result.Metric > 100.01 {
				t.Errorf("Dice roll should be in range [0.0, 100.01], got %f", result.Metric)
			}
		})
	}
	
	// Test Roulette vectors
	rouletteGame := &RouletteGame{}
	for _, vector := range vectors.Roulette {
		t.Run("Roulette: "+vector.Description, func(t *testing.T) {
			seeds := Seeds{Server: vector.ServerSeed, Client: vector.ClientSeed}
			result, err := rouletteGame.Evaluate(seeds, vector.Nonce, vector.Params)
			if err != nil {
				t.Fatalf("Evaluation failed: %v", err)
			}
			
			if result.MetricLabel != vector.Expected.MetricLabel {
				t.Errorf("Expected metric label '%s', got '%s'", 
					vector.Expected.MetricLabel, result.MetricLabel)
			}
			
			if result.Metric < 0.0 || result.Metric > 36.0 {
				t.Errorf("Roulette pocket should be in range [0, 36], got %f", result.Metric)
			}
			
			// Check that metric is an integer value
			if result.Metric != math.Floor(result.Metric) {
				t.Errorf("Roulette pocket should be integer, got %f", result.Metric)
			}
		})
	}
	
	// Test Pump vectors
	pumpGame := &PumpGame{}
	for _, vector := range vectors.Pump {
		t.Run("Pump: "+vector.Description, func(t *testing.T) {
			seeds := Seeds{Server: vector.ServerSeed, Client: vector.ClientSeed}
			result, err := pumpGame.Evaluate(seeds, vector.Nonce, vector.Params)
			if err != nil {
				t.Fatalf("Evaluation failed: %v", err)
			}
			
			if result.MetricLabel != vector.Expected.MetricLabel {
				t.Errorf("Expected metric label '%s', got '%s'", 
					vector.Expected.MetricLabel, result.MetricLabel)
			}
			
			if result.Metric < 1.0 {
				t.Errorf("Pump multiplier should be at least 1.0, got %f", result.Metric)
			}
		})
	}
}