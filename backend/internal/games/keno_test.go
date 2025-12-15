package games

import (
	"testing"

	"github.com/MJE43/stake-pf-replay-go/internal/engine"
)

func TestKenoDrawsMatchStake(t *testing.T) {
	// Test case from user - verified on Stake.com
	// Nonce: 1
	// Server Seed: fb30c5e2bbd8537b76c6df8e8e86533121cbeeae0bda9d306117147e656ad46e
	// Client Seed: 56e27fed-ece3-4279-ab56-96f71fe9b2ee
	// Expected draws (1-40 as displayed by Stake): 3, 7, 8, 13, 17, 27, 32, 35, 37, 39

	serverSeed := "fb30c5e2bbd8537b76c6df8e8e86533121cbeeae0bda9d306117147e656ad46e"
	clientSeed := "56e27fed-ece3-4279-ab56-96f71fe9b2ee"
	nonce := uint64(1)

	// Expected draws from Stake (1-40 display values)
	expected := []int{3, 7, 8, 13, 17, 27, 32, 35, 37, 39}

	game := &KenoGame{}
	seeds := Seeds{Server: serverSeed, Client: clientSeed}

	// Debug: Print the raw floats
	floats := engine.Floats(serverSeed, clientSeed, nonce, 0, 10)
	t.Logf("Floats: %v", floats)

	// Our implementation now returns 1-40 values directly
	draws := game.EvaluateDrawOnly(seeds, nonce)

	t.Logf("Our draws: %v", draws)
	t.Logf("Expected:  %v", expected)

	// Create maps for unordered comparison (draws may not be in same order)
	ourSet := make(map[int]bool)
	for _, d := range draws {
		ourSet[d] = true
	}

	expectedSet := make(map[int]bool)
	for _, exp := range expected {
		expectedSet[exp] = true
	}

	// Check if all expected draws are in our result
	for _, exp := range expected {
		if !ourSet[exp] {
			t.Errorf("Missing expected draw: %d", exp)
		}
	}

	// Check if we have any extra draws
	for _, our := range draws {
		if !expectedSet[our] {
			t.Errorf("Unexpected extra draw: %d", our)
		}
	}

	if len(draws) != 10 {
		t.Errorf("Expected 10 draws, got %d", len(draws))
	}
}

