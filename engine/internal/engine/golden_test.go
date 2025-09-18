package engine

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type RNGVector struct {
	Description string    `json:"description"`
	ServerSeed  string    `json:"server_seed"`
	ClientSeed  string    `json:"client_seed"`
	Nonce       uint64    `json:"nonce"`
	Cursor      uint64    `json:"cursor"`
	Count       int       `json:"count"`
	Expected    []float64 `json:"expected"`
}

func TestRNGGoldenVectors(t *testing.T) {
	// Load golden vectors
	vectors, err := loadRNGVectors()
	if err != nil {
		t.Fatalf("Failed to load golden vectors: %v", err)
	}

	for _, v := range vectors {
		t.Run(v.Description, func(t *testing.T) {
			actual := Floats(v.ServerSeed, v.ClientSeed, v.Nonce, v.Cursor, v.Count)
			
			if len(v.Expected) == 0 {
				// Generate expected values for the first time
				t.Logf("Generating expected values for: %s", v.Description)
				for i, f := range actual {
					t.Logf("  [%d]: %.15f", i, f)
				}
				return
			}
			
			if len(actual) != len(v.Expected) {
				t.Errorf("Length mismatch: got %d floats, want %d", len(actual), len(v.Expected))
				return
			}
			
			for i := range actual {
				if actual[i] != v.Expected[i] {
					t.Errorf("Float %d mismatch: got %.15f, want %.15f", i, actual[i], v.Expected[i])
				}
			}
		})
	}
}

func TestGenerateGoldenVectors(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping golden vector generation in short mode")
	}
	
	// This test generates the golden vectors - run manually when needed
	t.Skip("Manual test - uncomment to regenerate golden vectors")
	
	vectors, err := loadRNGVectors()
	if err != nil {
		t.Fatalf("Failed to load golden vectors: %v", err)
	}

	// Generate expected values
	for i := range vectors {
		vectors[i].Expected = Floats(
			vectors[i].ServerSeed,
			vectors[i].ClientSeed,
			vectors[i].Nonce,
			vectors[i].Cursor,
			vectors[i].Count,
		)
	}

	// Save updated vectors
	err = saveRNGVectors(vectors)
	if err != nil {
		t.Fatalf("Failed to save golden vectors: %v", err)
	}
	
	t.Log("Golden vectors updated successfully")
}

func loadRNGVectors() ([]RNGVector, error) {
	path := filepath.Join("..", "..", "testdata", "rng_golden.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var vectors []RNGVector
	err = json.Unmarshal(data, &vectors)
	return vectors, err
}

func saveRNGVectors(vectors []RNGVector) error {
	path := filepath.Join("..", "..", "testdata", "rng_golden.json")
	data, err := json.MarshalIndent(vectors, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(path, data, 0644)
}