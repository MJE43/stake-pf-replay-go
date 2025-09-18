package engine

import (
	"testing"
)

func TestGenerateFloats(t *testing.T) {
	tests := []struct {
		name       string
		serverSeed string
		clientSeed string
		nonce      uint64
		cursor     int
		count      int
		wantLen    int
	}{
		{
			name:       "basic float generation",
			serverSeed: "test_server_seed",
			clientSeed: "test_client_seed",
			nonce:      1,
			cursor:     0,
			count:      1,
			wantLen:    1,
		},
		{
			name:       "multiple floats",
			serverSeed: "test_server_seed",
			clientSeed: "test_client_seed",
			nonce:      1,
			cursor:     0,
			count:      8,
			wantLen:    8,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			floats := GenerateFloats(tt.serverSeed, tt.clientSeed, tt.nonce, tt.cursor, tt.count)
			
			if len(floats) != tt.wantLen {
				t.Errorf("GenerateFloats() returned %d floats, want %d", len(floats), tt.wantLen)
			}
			
			// Check that all floats are in range [0, 1)
			for i, f := range floats {
				if f < 0 || f >= 1 {
					t.Errorf("Float %d is out of range [0, 1): %f", i, f)
				}
			}
		})
	}
}

func TestDeterministicFloats(t *testing.T) {
	serverSeed := "deterministic_test"
	clientSeed := "client_test"
	nonce := uint64(42)
	
	// Generate floats twice with same parameters
	floats1 := GenerateFloats(serverSeed, clientSeed, nonce, 0, 5)
	floats2 := GenerateFloats(serverSeed, clientSeed, nonce, 0, 5)
	
	// Should be identical
	if len(floats1) != len(floats2) {
		t.Fatal("Float arrays have different lengths")
	}
	
	for i := range floats1 {
		if floats1[i] != floats2[i] {
			t.Errorf("Float %d differs: %f != %f", i, floats1[i], floats2[i])
		}
	}
}

func BenchmarkGenerateFloats(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		GenerateFloats(serverSeed, clientSeed, uint64(i), 0, 1)
	}
}