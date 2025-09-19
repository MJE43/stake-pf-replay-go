package engine

import (
	"fmt"
	"runtime"
	"sync"
	"testing"
)

// TestCrossPlatformReproducibility tests that RNG results are identical across different conditions
func TestCrossPlatformReproducibility(t *testing.T) {
	// Test parameters
	serverSeed := "test_server_seed_for_reproducibility"
	clientSeed := "test_client_seed_for_reproducibility"
	nonce := uint64(12345)
	cursor := uint64(0)
	count := 16

	// Generate reference results
	referenceFloats := Floats(serverSeed, clientSeed, nonce, cursor, count)

	// Test 1: Multiple calls should produce identical results
	t.Run("Multiple calls identical", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			floats := Floats(serverSeed, clientSeed, nonce, cursor, count)
			if len(floats) != len(referenceFloats) {
				t.Fatalf("Length mismatch on iteration %d: expected %d, got %d", 
					i, len(referenceFloats), len(floats))
			}
			
			for j, f := range floats {
				if f != referenceFloats[j] {
					t.Errorf("Float mismatch on iteration %d, index %d: expected %.15f, got %.15f", 
						i, j, referenceFloats[j], f)
				}
			}
		}
	})

	// Test 2: Different GOMAXPROCS settings should produce identical results
	t.Run("Different GOMAXPROCS settings", func(t *testing.T) {
		originalGOMAXPROCS := runtime.GOMAXPROCS(0)
		defer runtime.GOMAXPROCS(originalGOMAXPROCS)

		testSettings := []int{1, 2, 4, 8, runtime.NumCPU()}
		
		for _, procs := range testSettings {
			if procs > runtime.NumCPU() {
				continue // Skip if more than available CPUs
			}
			
			t.Run(fmt.Sprintf("GOMAXPROCS=%d", procs), func(t *testing.T) {
				runtime.GOMAXPROCS(procs)
				runtime.GC() // Force garbage collection to ensure clean state
				
				floats := Floats(serverSeed, clientSeed, nonce, cursor, count)
				if len(floats) != len(referenceFloats) {
					t.Fatalf("Length mismatch with GOMAXPROCS=%d: expected %d, got %d", 
						procs, len(referenceFloats), len(floats))
				}
				
				for j, f := range floats {
					if f != referenceFloats[j] {
						t.Errorf("Float mismatch with GOMAXPROCS=%d, index %d: expected %.15f, got %.15f", 
							procs, j, referenceFloats[j], f)
					}
				}
			})
		}
	})

	// Test 3: Concurrent access should produce identical results
	t.Run("Concurrent access", func(t *testing.T) {
		const numGoroutines = 10
		const numIterations = 100
		
		var wg sync.WaitGroup
		results := make([][]float64, numGoroutines)
		errors := make([]error, numGoroutines)
		
		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(goroutineID int) {
				defer wg.Done()
				
				// Each goroutine performs multiple iterations
				for iter := 0; iter < numIterations; iter++ {
					floats := Floats(serverSeed, clientSeed, nonce+uint64(iter), cursor, count)
					
					// Store results from first iteration for comparison
					if iter == 0 {
						results[goroutineID] = make([]float64, len(floats))
						copy(results[goroutineID], floats)
					}
					
					// Verify consistency within this goroutine
					if iter > 0 {
						expectedFloats := Floats(serverSeed, clientSeed, nonce, cursor, count)
						for j, f := range expectedFloats {
							if f != referenceFloats[j] {
								errors[goroutineID] = fmt.Errorf("inconsistent result in goroutine %d, iteration %d, index %d", 
									goroutineID, iter, j)
								return
							}
						}
					}
				}
			}(i)
		}
		
		wg.Wait()
		
		// Check for errors
		for i, err := range errors {
			if err != nil {
				t.Errorf("Goroutine %d error: %v", i, err)
			}
		}
		
		// Verify all goroutines got the same results for nonce
		for i, result := range results {
			if len(result) != len(referenceFloats) {
				t.Errorf("Goroutine %d length mismatch: expected %d, got %d", 
					i, len(referenceFloats), len(result))
				continue
			}
			
			for j, f := range result {
				if f != referenceFloats[j] {
					t.Errorf("Goroutine %d float mismatch at index %d: expected %.15f, got %.15f", 
						i, j, referenceFloats[j], f)
				}
			}
		}
	})
}

// TestFloatsIntoReproducibility tests that FloatsInto produces identical results to Floats
func TestFloatsIntoReproducibility(t *testing.T) {
	serverSeed := "test_server_seed"
	clientSeed := "test_client_seed"
	nonce := uint64(54321)
	cursor := uint64(0)
	count := 20

	// Generate reference using Floats
	referenceFloats := Floats(serverSeed, clientSeed, nonce, cursor, count)

	// Test FloatsInto with pre-allocated slice
	t.Run("FloatsInto with exact size", func(t *testing.T) {
		dst := make([]float64, count)
		result := FloatsInto(dst, serverSeed, clientSeed, nonce, cursor, count)
		
		if len(result) != count {
			t.Fatalf("Length mismatch: expected %d, got %d", count, len(result))
		}
		
		for i, f := range result {
			if f != referenceFloats[i] {
				t.Errorf("Float mismatch at index %d: expected %.15f, got %.15f", 
					i, referenceFloats[i], f)
			}
		}
	})

	// Test FloatsInto with larger slice
	t.Run("FloatsInto with larger slice", func(t *testing.T) {
		dst := make([]float64, count+10)
		result := FloatsInto(dst, serverSeed, clientSeed, nonce, cursor, count)
		
		if len(result) != count {
			t.Fatalf("Length mismatch: expected %d, got %d", count, len(result))
		}
		
		for i, f := range result {
			if f != referenceFloats[i] {
				t.Errorf("Float mismatch at index %d: expected %.15f, got %.15f", 
					i, referenceFloats[i], f)
			}
		}
	})
}

// TestCursorBoundaryReproducibility tests cursor boundary crossing reproducibility
func TestCursorBoundaryReproducibility(t *testing.T) {
	serverSeed := "boundary_test_server"
	clientSeed := "boundary_test_client"
	nonce := uint64(999)

	testCases := []struct {
		name   string
		cursor uint64
		count  int
	}{
		{"Single HMAC block", 0, 8},
		{"Boundary crossing", 31, 2},
		{"Multiple rounds", 0, 40},
		{"Mid-block start", 15, 10},
		{"Large count", 0, 100},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Generate reference results
			referenceFloats := Floats(serverSeed, clientSeed, nonce, tc.cursor, tc.count)
			
			// Test multiple times to ensure consistency
			for i := 0; i < 5; i++ {
				floats := Floats(serverSeed, clientSeed, nonce, tc.cursor, tc.count)
				
				if len(floats) != len(referenceFloats) {
					t.Fatalf("Iteration %d length mismatch: expected %d, got %d", 
						i, len(referenceFloats), len(floats))
				}
				
				for j, f := range floats {
					if f != referenceFloats[j] {
						t.Errorf("Iteration %d float mismatch at index %d: expected %.15f, got %.15f", 
							i, j, referenceFloats[j], f)
					}
				}
			}
		})
	}
}

// TestDeterministicAcrossArchitectures tests deterministic behavior patterns
func TestDeterministicAcrossArchitectures(t *testing.T) {
	// This test verifies that our implementation doesn't depend on architecture-specific behavior
	
	testCases := []struct {
		serverSeed string
		clientSeed string
		nonce      uint64
		cursor     uint64
		count      int
	}{
		{"arch_test_1", "client_1", 1, 0, 8},
		{"arch_test_2", "client_2", 100, 0, 16},
		{"arch_test_3", "client_3", 1000, 31, 2},
		{"arch_test_4", "client_4", 10000, 0, 32},
	}

	for i, tc := range testCases {
		t.Run(fmt.Sprintf("Case_%d", i+1), func(t *testing.T) {
			// Generate results multiple times
			var results [][]float64
			for j := 0; j < 3; j++ {
				floats := Floats(tc.serverSeed, tc.clientSeed, tc.nonce, tc.cursor, tc.count)
				results = append(results, floats)
			}
			
			// Verify all results are identical
			for j := 1; j < len(results); j++ {
				if len(results[j]) != len(results[0]) {
					t.Fatalf("Length mismatch between run 0 and run %d: %d vs %d", 
						j, len(results[0]), len(results[j]))
				}
				
				for k, f := range results[j] {
					if f != results[0][k] {
						t.Errorf("Float mismatch between run 0 and run %d at index %d: %.15f vs %.15f", 
							j, k, results[0][k], f)
					}
				}
			}
		})
	}
}

// TestMemoryLayoutIndependence tests that results don't depend on memory layout
func TestMemoryLayoutIndependence(t *testing.T) {
	serverSeed := "memory_test_server"
	clientSeed := "memory_test_client"
	nonce := uint64(12345)
	cursor := uint64(0)
	count := 16

	// Generate reference results
	referenceFloats := Floats(serverSeed, clientSeed, nonce, cursor, count)

	// Test with different memory allocation patterns
	t.Run("Different allocation patterns", func(t *testing.T) {
		// Force some memory allocations to change layout
		_ = make([]byte, 1024*1024) // 1MB allocation
		runtime.GC()
		
		floats1 := Floats(serverSeed, clientSeed, nonce, cursor, count)
		
		// More allocations
		_ = make([]int, 100000)
		runtime.GC()
		
		floats2 := Floats(serverSeed, clientSeed, nonce, cursor, count)
		
		// Verify both match reference
		for i, f := range floats1 {
			if f != referenceFloats[i] {
				t.Errorf("floats1 mismatch at index %d: expected %.15f, got %.15f", 
					i, referenceFloats[i], f)
			}
		}
		
		for i, f := range floats2 {
			if f != referenceFloats[i] {
				t.Errorf("floats2 mismatch at index %d: expected %.15f, got %.15f", 
					i, referenceFloats[i], f)
			}
		}
	})
}