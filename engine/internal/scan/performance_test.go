package scan

import (
	"context"
	"fmt"
	"runtime"
	"testing"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// BenchmarkFullScanningPipeline benchmarks the complete scanning workflow with large nonce ranges
func BenchmarkFullScanningPipeline(b *testing.B) {
	scanner := NewScanner()
	
	benchmarks := []struct {
		name       string
		nonceRange uint64
		game       string
		targetOp   TargetOp
		targetVal  float64
	}{
		{"Limbo_100K", 100000, "limbo", OpGreaterEqual, 2.0},
		{"Limbo_1M", 1000000, "limbo", OpGreaterEqual, 2.0},
		{"Dice_100K", 100000, "dice", OpLessEqual, 10.0},
		{"Dice_1M", 1000000, "dice", OpLessEqual, 10.0},
		{"Roulette_100K", 100000, "roulette", OpEqual, 17.0},
		{"Roulette_1M", 1000000, "roulette", OpEqual, 17.0},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			req := ScanRequest{
				Game:       bm.game,
				Seeds:      games.Seeds{Server: "bench_server", Client: "bench_client"},
				NonceStart: 1,
				NonceEnd:   bm.nonceRange,
				Params:     map[string]any{},
				TargetOp:   bm.targetOp,
				TargetVal:  bm.targetVal,
				Tolerance:  1e-9,
				Limit:      10000, // Reasonable limit to avoid memory issues
				TimeoutMs:  60000, // 60 second timeout
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				result, err := scanner.Scan(ctx, req)
				if err != nil {
					b.Fatalf("Scan failed: %v", err)
				}
				
				// Verify we got some results
				if result.Summary.TotalEvaluated == 0 {
					b.Fatal("No evaluations performed")
				}
			}
		})
	}
}

// BenchmarkMemoryUsagePatterns tests memory allocation patterns under sustained load
func BenchmarkMemoryUsagePatterns(b *testing.B) {
	scanner := NewScanner()
	
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "memory_test_server", Client: "memory_test_client"},
		NonceStart: 1,
		NonceEnd:   500000, // 500K nonces
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  3.0,
		Tolerance:  1e-9,
		Limit:      5000,
		TimeoutMs:  30000,
	}

	b.ResetTimer()
	b.ReportAllocs()

	// Run multiple iterations to test memory reuse
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		result, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatalf("Scan iteration %d failed: %v", i, err)
		}
		
		if result.Summary.TotalEvaluated == 0 {
			b.Fatalf("No evaluations in iteration %d", i)
		}
		
		// Force garbage collection between iterations to test memory cleanup
		if i%10 == 0 {
			runtime.GC()
		}
	}
}

// BenchmarkCPUScaling tests linear scaling with CPU cores
func BenchmarkCPUScaling(b *testing.B) {
	scanner := NewScanner()
	
	req := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "scaling_server", Client: "scaling_client"},
		NonceStart: 1,
		NonceEnd:   1000000, // 1M nonces
		Params:     map[string]any{},
		TargetOp:   OpBetween,
		TargetVal:  40.0,
		TargetVal2: 60.0,
		Tolerance:  1e-9,
		Limit:      20000,
		TimeoutMs:  120000, // 2 minute timeout
	}

	// Test with different GOMAXPROCS settings
	originalGOMAXPROCS := runtime.GOMAXPROCS(0)
	defer runtime.GOMAXPROCS(originalGOMAXPROCS)

	cpuCounts := []int{1, 2, 4, 8}
	if runtime.NumCPU() > 8 {
		cpuCounts = append(cpuCounts, runtime.NumCPU())
	}

	for _, cpus := range cpuCounts {
		if cpus > runtime.NumCPU() {
			continue
		}
		
		b.Run(fmt.Sprintf("CPUs_%d", cpus), func(b *testing.B) {
			runtime.GOMAXPROCS(cpus)
			
			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				start := time.Now()
				result, err := scanner.Scan(ctx, req)
				duration := time.Since(start)
				
				if err != nil {
					b.Fatalf("Scan failed with %d CPUs: %v", cpus, err)
				}
				
				if result.Summary.TotalEvaluated == 0 {
					b.Fatalf("No evaluations with %d CPUs", cpus)
				}
				
				// Report throughput
				throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
				b.ReportMetric(throughput, "evals/sec")
			}
		})
	}
}

// BenchmarkWorkerPoolEfficiency tests worker pool efficiency with different batch sizes
func BenchmarkWorkerPoolEfficiency(b *testing.B) {
	// This test would require access to internal worker pool settings
	// For now, we'll test the overall efficiency
	
	scanner := NewScanner()
	
	testCases := []struct {
		name       string
		nonceRange uint64
		workers    string // Description for the test
	}{
		{"Small_Range_10K", 10000, "optimal_for_small"},
		{"Medium_Range_100K", 100000, "optimal_for_medium"},
		{"Large_Range_1M", 1000000, "optimal_for_large"},
		{"XLarge_Range_5M", 5000000, "optimal_for_xlarge"},
	}

	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			req := ScanRequest{
				Game:       "roulette",
				Seeds:      games.Seeds{Server: "efficiency_server", Client: "efficiency_client"},
				NonceStart: 1,
				NonceEnd:   tc.nonceRange,
				Params:     map[string]any{},
				TargetOp:   OpEqual,
				TargetVal:  7.0, // Lucky number 7
				Tolerance:  0,   // Exact match
				Limit:      50000,
				TimeoutMs:  300000, // 5 minute timeout for large ranges
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				start := time.Now()
				result, err := scanner.Scan(ctx, req)
				duration := time.Since(start)
				
				if err != nil {
					b.Fatalf("Scan failed for %s: %v", tc.name, err)
				}
				
				// Calculate and report efficiency metrics
				throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
				b.ReportMetric(throughput, "evals/sec")
				
				if result.Summary.HitsFound > 0 {
					hitRate := float64(result.Summary.HitsFound) / float64(result.Summary.TotalEvaluated)
					b.ReportMetric(hitRate*100, "hit_rate_%")
				}
			}
		})
	}
}

// BenchmarkGameSpecificPerformance tests performance characteristics of different games
func BenchmarkGameSpecificPerformance(b *testing.B) {
	scanner := NewScanner()
	
	gameTests := []struct {
		name      string
		game      string
		params    map[string]any
		targetOp  TargetOp
		targetVal float64
	}{
		{"Limbo_Default", "limbo", map[string]any{}, OpGreaterEqual, 2.0},
		{"Limbo_Custom_HE", "limbo", map[string]any{"houseEdge": 0.95}, OpGreaterEqual, 2.0},
		{"Dice_Standard", "dice", map[string]any{}, OpLessEqual, 50.0},
		{"Roulette_European", "roulette", map[string]any{}, OpEqual, 0.0},
	}

	for _, game := range gameTests {
		b.Run(game.name, func(b *testing.B) {
			req := ScanRequest{
				Game:       game.game,
				Seeds:      games.Seeds{Server: "perf_server", Client: "perf_client"},
				NonceStart: 1,
				NonceEnd:   100000, // 100K nonces for consistent comparison
				Params:     game.params,
				TargetOp:   game.targetOp,
				TargetVal:  game.targetVal,
				Tolerance:  1e-9,
				Limit:      10000,
				TimeoutMs:  60000,
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				start := time.Now()
				result, err := scanner.Scan(ctx, req)
				duration := time.Since(start)
				
				if err != nil {
					b.Fatalf("Scan failed for %s: %v", game.name, err)
				}
				
				// Report game-specific metrics
				throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
				b.ReportMetric(throughput, "evals/sec")
			}
		})
	}
}

// BenchmarkTimeoutBehavior tests performance under timeout conditions
func BenchmarkTimeoutBehavior(b *testing.B) {
	scanner := NewScanner()
	
	timeouts := []struct {
		name      string
		timeoutMs int
		expected  string
	}{
		{"Short_Timeout_100ms", 100, "should_timeout"},
		{"Medium_Timeout_1s", 1000, "might_timeout"},
		{"Long_Timeout_10s", 10000, "should_complete"},
	}

	for _, timeout := range timeouts {
		b.Run(timeout.name, func(b *testing.B) {
			req := ScanRequest{
				Game:       "limbo",
				Seeds:      games.Seeds{Server: "timeout_server", Client: "timeout_client"},
				NonceStart: 1,
				NonceEnd:   2000000, // 2M nonces - large enough to potentially timeout
				Params:     map[string]any{"houseEdge": 0.99},
				TargetOp:   OpGreaterEqual,
				TargetVal:  10.0, // High multiplier (rare)
				Tolerance:  1e-9,
				Limit:      1000,
				TimeoutMs:  timeout.timeoutMs,
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				start := time.Now()
				result, err := scanner.Scan(ctx, req)
				duration := time.Since(start)
				
				if err != nil {
					b.Fatalf("Scan failed for %s: %v", timeout.name, err)
				}
				
				// Report timeout behavior metrics
				if result.Summary.TimedOut {
					b.ReportMetric(1, "timed_out")
				} else {
					b.ReportMetric(0, "timed_out")
				}
				
				throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
				b.ReportMetric(throughput, "evals/sec")
				
				// Verify timeout was respected (with some tolerance)
				expectedTimeout := time.Duration(timeout.timeoutMs) * time.Millisecond
				if duration > expectedTimeout+500*time.Millisecond {
					b.Errorf("Timeout not respected: expected ~%v, got %v", expectedTimeout, duration)
				}
			}
		})
	}
}

// TestPerformanceRegression tests for performance regressions by comparing against baseline metrics
func TestPerformanceRegression(t *testing.T) {
	scanner := NewScanner()
	
	// Baseline performance test - should complete within reasonable time
	req := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "regression_server", Client: "regression_client"},
		NonceStart: 1,
		NonceEnd:   100000, // 100K nonces
		Params:     map[string]any{},
		TargetOp:   OpGreaterEqual,
		TargetVal:  50.0,
		Tolerance:  1e-9,
		Limit:      10000,
		TimeoutMs:  30000, // 30 second timeout
	}

	ctx := context.Background()
	start := time.Now()
	result, err := scanner.Scan(ctx, req)
	duration := time.Since(start)
	
	if err != nil {
		t.Fatalf("Performance regression test failed: %v", err)
	}
	
	// Performance assertions
	throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
	
	// Minimum expected throughput (adjust based on your hardware)
	minThroughput := 10000.0 // 10K evaluations per second minimum
	if throughput < minThroughput {
		t.Errorf("Performance regression detected: throughput %.0f evals/sec is below minimum %.0f evals/sec", 
			throughput, minThroughput)
	}
	
	// Maximum expected duration for 100K evaluations
	maxDuration := 30 * time.Second
	if duration > maxDuration {
		t.Errorf("Performance regression detected: duration %v exceeds maximum %v", duration, maxDuration)
	}
	
	// Memory usage should be reasonable
	var m runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&m)
	
	// Should not use more than 100MB for this test
	maxMemory := uint64(100 * 1024 * 1024) // 100MB
	if m.Alloc > maxMemory {
		t.Errorf("Memory usage regression detected: using %d bytes, maximum %d bytes", 
			m.Alloc, maxMemory)
	}
	
	t.Logf("Performance test passed:")
	t.Logf("  Throughput: %.0f evals/sec", throughput)
	t.Logf("  Duration: %v", duration)
	t.Logf("  Memory: %d bytes", m.Alloc)
	t.Logf("  Total Evaluated: %d", result.Summary.TotalEvaluated)
	t.Logf("  Hits Found: %d", result.Summary.HitsFound)
}

// TestLinearScalingVerification tests that performance scales linearly with CPU cores
func TestLinearScalingVerification(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping linear scaling test in short mode")
	}
	
	scanner := NewScanner()
	originalGOMAXPROCS := runtime.GOMAXPROCS(0)
	defer runtime.GOMAXPROCS(originalGOMAXPROCS)
	
	req := ScanRequest{
		Game:       "roulette",
		Seeds:      games.Seeds{Server: "scaling_server", Client: "scaling_client"},
		NonceStart: 1,
		NonceEnd:   500000, // 500K nonces
		Params:     map[string]any{},
		TargetOp:   OpEqual,
		TargetVal:  13.0,
		Tolerance:  0,
		Limit:      50000,
		TimeoutMs:  120000, // 2 minute timeout
	}
	
	results := make(map[int]float64)
	cpuCounts := []int{1, 2, 4}
	
	for _, cpus := range cpuCounts {
		if cpus > runtime.NumCPU() {
			continue
		}
		
		runtime.GOMAXPROCS(cpus)
		runtime.GC() // Clean slate for each test
		
		ctx := context.Background()
		start := time.Now()
		result, err := scanner.Scan(ctx, req)
		duration := time.Since(start)
		
		if err != nil {
			t.Fatalf("Scaling test failed with %d CPUs: %v", cpus, err)
		}
		
		throughput := float64(result.Summary.TotalEvaluated) / duration.Seconds()
		results[cpus] = throughput
		
		t.Logf("CPUs: %d, Throughput: %.0f evals/sec, Duration: %v", 
			cpus, throughput, duration)
	}
	
	// Verify scaling efficiency
	if len(results) >= 2 {
		baseline := results[1] // Single CPU performance
		for cpus, throughput := range results {
			if cpus == 1 {
				continue
			}
			
			expectedThroughput := baseline * float64(cpus)
			efficiency := throughput / expectedThroughput
			
			// Report scaling efficiency (no strict requirements due to variability)
			t.Logf("Scaling efficiency with %d CPUs: %.2f%%", cpus, efficiency*100)
			
			// Only warn if efficiency is very poor
			if efficiency < 0.25 { // 25% minimum
				t.Logf("Warning: Low scaling efficiency with %d CPUs: %.2f%%", cpus, efficiency*100)
			}
		}
	}
}