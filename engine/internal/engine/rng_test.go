package engine

import (
	"testing"
)

func TestFloats(t *testing.T) {
	tests := []struct {
		name       string
		serverSeed string
		clientSeed string
		nonce      uint64
		cursor     uint64
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
		{
			name:       "cursor boundary test",
			serverSeed: "test_server_seed",
			clientSeed: "test_client_seed",
			nonce:      1,
			cursor:     31,
			count:      2,
			wantLen:    2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			floats := Floats(tt.serverSeed, tt.clientSeed, tt.nonce, tt.cursor, tt.count)
			
			if len(floats) != tt.wantLen {
				t.Errorf("Floats() returned %d floats, want %d", len(floats), tt.wantLen)
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

func TestFloatsInto(t *testing.T) {
	serverSeed := "test_server_seed"
	clientSeed := "test_client_seed"
	nonce := uint64(1)
	
	// Test with pre-allocated buffer
	dst := make([]float64, 10)
	result := FloatsInto(dst, serverSeed, clientSeed, nonce, 0, 5)
	
	if len(result) != 5 {
		t.Errorf("FloatsInto() returned %d floats, want 5", len(result))
	}
	
	// Test with too small buffer
	smallDst := make([]float64, 2)
	result2 := FloatsInto(smallDst, serverSeed, clientSeed, nonce, 0, 5)
	
	if len(result2) != 5 {
		t.Errorf("FloatsInto() with small buffer returned %d floats, want 5", len(result2))
	}
}

func TestDeterministicFloats(t *testing.T) {
	serverSeed := "deterministic_test"
	clientSeed := "client_test"
	nonce := uint64(42)
	
	// Generate floats twice with same parameters
	floats1 := Floats(serverSeed, clientSeed, nonce, 0, 5)
	floats2 := Floats(serverSeed, clientSeed, nonce, 0, 5)
	
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

func TestBytesToFloat(t *testing.T) {
	tests := []struct {
		name     string
		bytes    [4]byte
		expected float64
	}{
		{
			name:     "all zeros",
			bytes:    [4]byte{0, 0, 0, 0},
			expected: 0.0,
		},
		{
			name:     "all max values",
			bytes:    [4]byte{255, 255, 255, 255},
			expected: 255.0/256.0 + 255.0/(256.0*256.0) + 255.0/(256.0*256.0*256.0) + 255.0/(256.0*256.0*256.0*256.0),
		},
		{
			name:     "specific pattern",
			bytes:    [4]byte{128, 64, 32, 16},
			expected: 128.0/256.0 + 64.0/(256.0*256.0) + 32.0/(256.0*256.0*256.0) + 16.0/(256.0*256.0*256.0*256.0),
		},
		{
			name:     "edge case - first byte only",
			bytes:    [4]byte{1, 0, 0, 0},
			expected: 1.0/256.0,
		},
		{
			name:     "edge case - last byte only",
			bytes:    [4]byte{0, 0, 0, 1},
			expected: 1.0/(256.0*256.0*256.0*256.0),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := bytesToFloat(tt.bytes)
			if result != tt.expected {
				t.Errorf("bytesToFloat() = %.15f, want %.15f", result, tt.expected)
			}
		})
	}
}

func TestBytesToFloatFormula(t *testing.T) {
	// Test the exact formula: b0/256 + b1/256² + b2/256³ + b3/256⁴
	bytes := [4]byte{100, 150, 200, 250}
	
	expected := float64(100)/256.0 + 
				float64(150)/(256.0*256.0) + 
				float64(200)/(256.0*256.0*256.0) + 
				float64(250)/(256.0*256.0*256.0*256.0)
	
	result := bytesToFloat(bytes)
	
	if result != expected {
		t.Errorf("bytesToFloat() formula mismatch: got %.15f, want %.15f", result, expected)
	}
	
	// Verify the result is in range [0, 1)
	if result < 0 || result >= 1 {
		t.Errorf("bytesToFloat() result out of range [0, 1): %f", result)
	}
}

func TestBytesToFloatDeterministic(t *testing.T) {
	// Test that the same bytes always produce the same float
	bytes := [4]byte{42, 84, 126, 168}
	
	result1 := bytesToFloat(bytes)
	result2 := bytesToFloat(bytes)
	
	if result1 != result2 {
		t.Errorf("bytesToFloat() not deterministic: %f != %f", result1, result2)
	}
}

func TestBytesToFloatRange(t *testing.T) {
	// Test various byte combinations to ensure all results are in [0, 1)
	testCases := [][4]byte{
		{0, 0, 0, 0},
		{255, 255, 255, 255},
		{128, 128, 128, 128},
		{1, 2, 3, 4},
		{255, 0, 255, 0},
		{0, 255, 0, 255},
	}
	
	for i, bytes := range testCases {
		result := bytesToFloat(bytes)
		if result < 0 || result >= 1 {
			t.Errorf("Test case %d: bytesToFloat(%v) = %f, out of range [0, 1)", i, bytes, result)
		}
	}
}

func TestByteGenerator(t *testing.T) {
	serverSeed := "test_server"
	clientSeed := "test_client"
	nonce := uint64(1)
	
	bg := NewByteGenerator(serverSeed, clientSeed, nonce, 0)
	
	// Generate some bytes
	bytes := make([]byte, 40) // More than one HMAC round
	for i := range bytes {
		bytes[i] = bg.Next()
	}
	
	// Should have generated bytes
	allZero := true
	for _, b := range bytes {
		if b != 0 {
			allZero = false
			break
		}
	}
	
	if allZero {
		t.Error("ByteGenerator produced all zero bytes")
	}
}

func TestHMACMessageFormat(t *testing.T) {
	// Test that HMAC message format is exactly: ${clientSeed}:${nonce}:${currentRound}
	serverSeed := "test_server"
	clientSeed := "test_client"
	nonce := uint64(123)
	
	// Create two generators with different starting rounds
	bg1 := NewByteGenerator(serverSeed, clientSeed, nonce, 0)  // round 0
	bg2 := NewByteGenerator(serverSeed, clientSeed, nonce, 32) // round 1
	
	// Get first byte from each
	b1 := bg1.Next()
	b2 := bg2.Next()
	
	// They should be different since they use different rounds
	if b1 == b2 {
		t.Error("Expected different bytes from different rounds, but got same")
	}
}

func TestCursorBoundaryHandling(t *testing.T) {
	serverSeed := "boundary_test"
	clientSeed := "client_test"
	nonce := uint64(1)
	
	// Test cursor=31 with count=2 (should cross boundary)
	floats := Floats(serverSeed, clientSeed, nonce, 31, 2)
	
	if len(floats) != 2 {
		t.Errorf("Expected 2 floats, got %d", len(floats))
	}
	
	// Verify the floats are valid
	for i, f := range floats {
		if f < 0 || f >= 1 {
			t.Errorf("Float %d out of range [0,1): %f", i, f)
		}
	}
	
	// Test that we get consistent results
	floats2 := Floats(serverSeed, clientSeed, nonce, 31, 2)
	for i := range floats {
		if floats[i] != floats2[i] {
			t.Errorf("Inconsistent results at index %d: %f != %f", i, floats[i], floats2[i])
		}
	}
}

func BenchmarkFloats(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Floats(serverSeed, clientSeed, uint64(i), 0, 1)
	}
}

func BenchmarkFloatsInto(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	dst := make([]float64, 8)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		FloatsInto(dst, serverSeed, clientSeed, uint64(i), 0, 8)
	}
}

func BenchmarkSingleFloat(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Floats(serverSeed, clientSeed, uint64(i), 0, 1)
	}
}

func BenchmarkBatchFloat8(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Floats(serverSeed, clientSeed, uint64(i), 0, 8)
	}
}

func BenchmarkBatchFloat40(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Floats(serverSeed, clientSeed, uint64(i), 0, 40)
	}
}

func BenchmarkCursorBoundary(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// cursor=31 with count=2 forces boundary crossing
		Floats(serverSeed, clientSeed, uint64(i), 31, 2)
	}
}

func BenchmarkByteGenerator(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bg := NewByteGenerator(serverSeed, clientSeed, uint64(i), 0)
		for j := 0; j < 32; j++ {
			bg.Next()
		}
	}
}

func BenchmarkBytesToFloat(b *testing.B) {
	bytes := [4]byte{123, 45, 67, 89}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bytesToFloat(bytes)
	}
}

func BenchmarkFloatsIntoReuse(b *testing.B) {
	serverSeed := "benchmark_server_seed"
	clientSeed := "benchmark_client_seed"
	dst := make([]float64, 40) // Pre-allocate for reuse
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		FloatsInto(dst, serverSeed, clientSeed, uint64(i), 0, 8)
	}
}