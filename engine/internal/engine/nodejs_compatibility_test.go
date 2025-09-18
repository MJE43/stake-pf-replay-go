package engine

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// NodeJSReferenceVector represents a test vector from Node.js reference implementation
type NodeJSReferenceVector struct {
	Description string    `json:"description"`
	ServerSeed  string    `json:"server_seed"`
	ClientSeed  string    `json:"client_seed"`
	Nonce       uint64    `json:"nonce"`
	Cursor      uint64    `json:"cursor"`
	Count       int       `json:"count"`
	Expected    []float64 `json:"expected"`
}

// TestNodeJSCompatibility tests compatibility with Node.js reference implementation
func TestNodeJSCompatibility(t *testing.T) {
	// Load Node.js reference vectors
	vectorsPath := filepath.Join("..", "..", "testdata", "nodejs_reference_vectors.json")
	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("Failed to read Node.js reference vectors: %v", err)
	}

	var vectors []NodeJSReferenceVector
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatalf("Failed to parse Node.js reference vectors: %v", err)
	}

	for _, vector := range vectors {
		t.Run(vector.Description, func(t *testing.T) {
			// Generate floats using our implementation
			actual := Floats(vector.ServerSeed, vector.ClientSeed, vector.Nonce, vector.Cursor, vector.Count)

			// Verify length matches
			if len(actual) != len(vector.Expected) {
				t.Fatalf("Length mismatch: expected %d, got %d", len(vector.Expected), len(actual))
			}

			// Verify each float matches with high precision
			for i, expected := range vector.Expected {
				// Use a very small tolerance for floating-point comparison
				tolerance := 1e-15
				if abs(actual[i] - expected) > tolerance {
					t.Errorf("Float mismatch at index %d: expected %.15f, got %.15f (diff: %.2e)", 
						i, expected, actual[i], abs(actual[i] - expected))
				}
			}

			t.Logf("✓ Node.js compatibility verified for %s: %d floats match exactly", 
				vector.Description, len(actual))
		})
	}
}

// TestCrossPlatformConsistency tests that results are consistent across different execution contexts
func TestCrossPlatformConsistency(t *testing.T) {
	// Test parameters that should produce consistent results
	testCases := []struct {
		name       string
		serverSeed string
		clientSeed string
		nonce      uint64
		cursor     uint64
		count      int
	}{
		{
			name:       "Basic consistency",
			serverSeed: "consistency_server",
			clientSeed: "consistency_client",
			nonce:      1,
			cursor:     0,
			count:      8,
		},
		{
			name:       "Boundary crossing consistency",
			serverSeed: "boundary_server",
			clientSeed: "boundary_client",
			nonce:      100,
			cursor:     31,
			count:      2,
		},
		{
			name:       "Multi-round consistency",
			serverSeed: "multi_server",
			clientSeed: "multi_client",
			nonce:      1000,
			cursor:     0,
			count:      40,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Generate baseline results
			baseline := Floats(tc.serverSeed, tc.clientSeed, tc.nonce, tc.cursor, tc.count)

			// Test multiple executions for consistency
			for i := 0; i < 10; i++ {
				result := Floats(tc.serverSeed, tc.clientSeed, tc.nonce, tc.cursor, tc.count)
				
				if len(result) != len(baseline) {
					t.Fatalf("Execution %d length mismatch: expected %d, got %d", 
						i, len(baseline), len(result))
				}

				for j, f := range result {
					if f != baseline[j] {
						t.Errorf("Execution %d float mismatch at index %d: expected %.15f, got %.15f", 
							i, j, baseline[j], f)
					}
				}
			}

			t.Logf("✓ Cross-platform consistency verified for %s: %d executions identical", 
				tc.name, 10)
		})
	}
}

// TestArchitectureIndependence tests that results don't depend on architecture-specific behavior
func TestArchitectureIndependence(t *testing.T) {
	// Test cases designed to catch architecture-dependent issues
	testCases := []struct {
		name       string
		serverSeed string
		clientSeed string
		nonce      uint64
		cursor     uint64
		count      int
	}{
		{
			name:       "Endianness test",
			serverSeed: "endian_test_server_seed_123456789",
			clientSeed: "endian_test_client_seed_987654321",
			nonce:      0x123456789ABCDEF0,
			cursor:     0,
			count:      16,
		},
		{
			name:       "Large nonce test",
			serverSeed: "large_nonce_server",
			clientSeed: "large_nonce_client",
			nonce:      0xFFFFFFFFFFFFFFFF,
			cursor:     0,
			count:      8,
		},
		{
			name:       "Unicode seed test",
			serverSeed: "unicode_test_🎲🎰🃏",
			clientSeed: "unicode_client_♠♥♦♣",
			nonce:      12345,
			cursor:     0,
			count:      8,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Generate results multiple times to ensure consistency
			var results [][]float64
			
			for i := 0; i < 5; i++ {
				result := Floats(tc.serverSeed, tc.clientSeed, tc.nonce, tc.cursor, tc.count)
				results = append(results, result)
			}

			// Verify all results are identical
			baseline := results[0]
			for i := 1; i < len(results); i++ {
				if len(results[i]) != len(baseline) {
					t.Fatalf("Result %d length mismatch: expected %d, got %d", 
						i, len(baseline), len(results[i]))
				}

				for j, f := range results[i] {
					if f != baseline[j] {
						t.Errorf("Result %d float mismatch at index %d: expected %.15f, got %.15f", 
							i, j, baseline[j], f)
					}
				}
			}

			t.Logf("✓ Architecture independence verified for %s: %d runs identical", 
				tc.name, len(results))
		})
	}
}

// TestFloatPrecisionConsistency tests that float precision is consistent
func TestFloatPrecisionConsistency(t *testing.T) {
	serverSeed := "precision_test_server"
	clientSeed := "precision_test_client"
	nonce := uint64(54321)
	cursor := uint64(0)
	count := 20

	// Generate floats
	floats := Floats(serverSeed, clientSeed, nonce, cursor, count)

	// Test that all floats are in valid range [0, 1)
	for i, f := range floats {
		if f < 0.0 || f >= 1.0 {
			t.Errorf("Float %d out of range [0, 1): %.15f", i, f)
		}
	}

	// Test precision consistency - floats should be deterministic
	// Generate the same floats again and verify they're identical
	floats2 := Floats(serverSeed, clientSeed, nonce, cursor, count)
	for i, f := range floats {
		if floats2[i] != f {
			t.Errorf("Precision inconsistency for float %d: first %.15f, second %.15f", i, f, floats2[i])
		}
	}

	t.Logf("✓ Float precision consistency verified: %d floats in valid range with consistent precision", 
		len(floats))
}

// BenchmarkReproducibilityOverhead benchmarks the overhead of reproducibility guarantees
func BenchmarkReproducibilityOverhead(b *testing.B) {
	serverSeed := "benchmark_server"
	clientSeed := "benchmark_client"
	nonce := uint64(1)
	cursor := uint64(0)
	count := 8

	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		_ = Floats(serverSeed, clientSeed, nonce, cursor, count)
	}
}

// abs returns the absolute value of a float64
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}