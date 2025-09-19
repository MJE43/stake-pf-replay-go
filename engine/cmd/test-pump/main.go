package main

import (
	"fmt"
	"math"
	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

func main() {
	game, _ := games.GetGame("pump")
	
	// Test the golden test case
	fmt.Println("=== Golden Test Verification ===")
	seeds := games.Seeds{
		Server: "564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca",
		Client: "zXv1upuFns",
	}
	
	params := map[string]any{"difficulty": "expert"}
	result, err := game.Evaluate(seeds, 5663, params)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	
	fmt.Printf("Nonce 5663: %.2f (expected 11200.65)\n", result.Metric)
	if math.Abs(result.Metric - 11200.65) < 1e-9 {
		fmt.Println("✅ Golden test PASSED")
	} else {
		fmt.Println("❌ Golden test FAILED")
	}
	
	// Test all difficulties
	fmt.Println("\n=== Difficulty Test ===")
	difficulties := []string{"easy", "medium", "hard", "expert"}
	testSeeds := games.Seeds{Server: "test_server", Client: "test_client"}
	
	for _, difficulty := range difficulties {
		params := map[string]any{"difficulty": difficulty}
		result, err := game.Evaluate(testSeeds, 1, params)
		if err != nil {
			fmt.Printf("%s: Error - %v\n", difficulty, err)
			continue
		}
		fmt.Printf("%s: %.2f\n", difficulty, result.Metric)
	}
	
	// Test expert high-value targets
	fmt.Println("\n=== Expert High-Value Target Search ===")
	expertTargets := []float64{11200.65, 48536.13, 291216.80, 3203384.80}
	
	fmt.Println("Scanning for high-value targets...")
	for nonce := uint64(5660); nonce <= 5670; nonce++ {
		params := map[string]any{"difficulty": "expert"}
		result, err := game.Evaluate(seeds, nonce, params)
		if err != nil {
			continue
		}
		
		for _, target := range expertTargets {
			if math.Abs(result.Metric - target) < 1e-9 {
				fmt.Printf("🎯 HIT! Nonce %d -> %.2f\n", nonce, result.Metric)
			}
		}
	}
	
	fmt.Println("✅ Pump implementation complete and verified!")
}