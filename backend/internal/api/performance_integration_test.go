package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// BenchmarkEndToEndHTTPPerformance benchmarks the complete HTTP API performance
func BenchmarkEndToEndHTTPPerformance(b *testing.B) {
	server := NewServer(&mockDB{})
	
	benchmarks := []struct {
		name       string
		nonceRange uint64
		game       string
		targetOp   string
		targetVal  float64
	}{
		{"HTTP_Limbo_100K", 100000, "limbo", "ge", 2.0},
		{"HTTP_Dice_100K", 100000, "dice", "le", 10.0},
		{"HTTP_Roulette_100K", 100000, "roulette", "eq", 17.0},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			request := ScanRequest{
				Game:       bm.game,
				Seeds:      games.Seeds{Server: "http_bench_server", Client: "http_bench_client"},
				NonceStart: 1,
				NonceEnd:   bm.nonceRange,
				Params:     map[string]any{},
				TargetOp:   bm.targetOp,
				TargetVal:  bm.targetVal,
				Tolerance:  1e-9,
				Limit:      5000,
				TimeoutMs:  60000,
			}

			body, err := json.Marshal(request)
			if err != nil {
				b.Fatalf("Failed to marshal request: %v", err)
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()

				start := time.Now()
				server.Routes().ServeHTTP(w, req)
				duration := time.Since(start)

				if w.Code != http.StatusOK {
					b.Fatalf("HTTP request failed: status %d", w.Code)
				}

				var response ScanResponse
				if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
					b.Fatalf("Failed to decode response: %v", err)
				}

				// Report metrics
				throughput := float64(response.Summary.TotalEvaluated) / duration.Seconds()
				b.ReportMetric(throughput, "evals/sec")
				b.ReportMetric(float64(len(response.Hits)), "hits_found")
			}
		})
	}
}

// BenchmarkConcurrentHTTPRequests benchmarks concurrent HTTP request handling
func BenchmarkConcurrentHTTPRequests(b *testing.B) {
	server := NewServer(&mockDB{})
	
	request := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "concurrent_server", Client: "concurrent_client"},
		NonceStart: 1,
		NonceEnd:   50000, // Smaller range for concurrent testing
		Params:     map[string]any{},
		TargetOp:   "ge",
		TargetVal:  50.0,
		Tolerance:  1e-9,
		Limit:      1000,
		TimeoutMs:  30000,
	}

	body, err := json.Marshal(request)
	if err != nil {
		b.Fatalf("Failed to marshal request: %v", err)
	}

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Routes().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				b.Errorf("HTTP request failed: status %d", w.Code)
			}
		}
	})
}

// TestSystemPerformanceUnderLoad tests system performance under sustained load
func TestSystemPerformanceUnderLoad(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping load test in short mode")
	}

	server := NewServer(&mockDB{})
	
	// Test configuration
	const (
		numRequests    = 10
		requestTimeout = 30 * time.Second
		nonceRange     = 100000
	)

	request := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "load_test_server", Client: "load_test_client"},
		NonceStart: 1,
		NonceEnd:   nonceRange,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   "ge",
		TargetVal:  3.0,
		Tolerance:  1e-9,
		Limit:      2000,
		TimeoutMs:  int(requestTimeout.Milliseconds()),
	}

	body, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	// Collect performance metrics
	var totalDuration time.Duration
	var totalEvaluations uint64
	var totalHits int
	var memoryBefore, memoryAfter runtime.MemStats

	runtime.GC()
	runtime.ReadMemStats(&memoryBefore)

	start := time.Now()

	// Execute multiple requests sequentially to test sustained performance
	for i := 0; i < numRequests; i++ {
		req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		requestStart := time.Now()
		server.Routes().ServeHTTP(w, req)
		requestDuration := time.Since(requestStart)

		if w.Code != http.StatusOK {
			t.Fatalf("Request %d failed: status %d, body: %s", i, w.Code, w.Body.String())
		}

		var response ScanResponse
		if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response for request %d: %v", i, err)
		}

		totalDuration += requestDuration
		totalEvaluations += response.Summary.TotalEvaluated
		totalHits += len(response.Hits)

		t.Logf("Request %d: %v duration, %d evaluations, %d hits", 
			i+1, requestDuration, response.Summary.TotalEvaluated, len(response.Hits))
	}

	totalTestDuration := time.Since(start)

	runtime.GC()
	runtime.ReadMemStats(&memoryAfter)

	// Calculate performance metrics
	avgDuration := totalDuration / numRequests
	totalThroughput := float64(totalEvaluations) / totalTestDuration.Seconds()
	avgThroughput := float64(totalEvaluations) / totalDuration.Seconds()
	memoryUsed := memoryAfter.Alloc - memoryBefore.Alloc

	// Performance assertions
	maxAvgDuration := 15 * time.Second
	if avgDuration > maxAvgDuration {
		t.Errorf("Average request duration %v exceeds maximum %v", avgDuration, maxAvgDuration)
	}

	minThroughput := 5000.0 // 5K evaluations per second minimum
	if avgThroughput < minThroughput {
		t.Errorf("Average throughput %.0f evals/sec is below minimum %.0f evals/sec", 
			avgThroughput, minThroughput)
	}

	// Memory usage should be reasonable (allow up to 200MB for sustained load)
	maxMemoryUsage := uint64(200 * 1024 * 1024) // 200MB
	if memoryUsed > maxMemoryUsage {
		t.Errorf("Memory usage %d bytes exceeds maximum %d bytes", memoryUsed, maxMemoryUsage)
	}

	// Report results
	t.Logf("Load test completed successfully:")
	t.Logf("  Requests: %d", numRequests)
	t.Logf("  Total Duration: %v", totalTestDuration)
	t.Logf("  Average Request Duration: %v", avgDuration)
	t.Logf("  Total Evaluations: %d", totalEvaluations)
	t.Logf("  Total Hits: %d", totalHits)
	t.Logf("  Total Throughput: %.0f evals/sec", totalThroughput)
	t.Logf("  Average Throughput: %.0f evals/sec", avgThroughput)
	t.Logf("  Memory Used: %d bytes", memoryUsed)
}

// TestMemoryLeakDetection tests for memory leaks during sustained operation
func TestMemoryLeakDetection(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping memory leak test in short mode")
	}

	server := NewServer(&mockDB{})
	
	request := ScanRequest{
		Game:       "roulette",
		Seeds:      games.Seeds{Server: "memory_leak_server", Client: "memory_leak_client"},
		NonceStart: 1,
		NonceEnd:   50000,
		Params:     map[string]any{},
		TargetOp:   "eq",
		TargetVal:  7.0,
		Tolerance:  0,
		Limit:      1000,
		TimeoutMs:  20000,
	}

	body, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	// Baseline memory measurement
	runtime.GC()
	var baseline runtime.MemStats
	runtime.ReadMemStats(&baseline)

	// Run multiple iterations
	const iterations = 20
	for i := 0; i < iterations; i++ {
		req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		server.Routes().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("Request %d failed: status %d", i, w.Code)
		}

		// Force garbage collection every few iterations
		if i%5 == 0 {
			runtime.GC()
		}
	}

	// Final memory measurement
	runtime.GC()
	var final runtime.MemStats
	runtime.ReadMemStats(&final)

	// Check for memory leaks
	memoryGrowth := final.Alloc - baseline.Alloc
	maxGrowth := uint64(50 * 1024 * 1024) // 50MB maximum growth

	if memoryGrowth > maxGrowth {
		t.Errorf("Potential memory leak detected: memory grew by %d bytes (max allowed: %d bytes)", 
			memoryGrowth, maxGrowth)
	}

	t.Logf("Memory leak test passed:")
	t.Logf("  Iterations: %d", iterations)
	t.Logf("  Baseline Memory: %d bytes", baseline.Alloc)
	t.Logf("  Final Memory: %d bytes", final.Alloc)
	t.Logf("  Memory Growth: %d bytes", memoryGrowth)
}

// BenchmarkVerifyEndpointPerformance benchmarks the verify endpoint performance
func BenchmarkVerifyEndpointPerformance(b *testing.B) {
	server := NewServer(&mockDB{})
	
	gameTests := []struct {
		name string
		game string
	}{
		{"Verify_Limbo", "limbo"},
		{"Verify_Dice", "dice"},
		{"Verify_Roulette", "roulette"},
	}

	for _, game := range gameTests {
		b.Run(game.name, func(b *testing.B) {
			request := VerifyRequest{
				Game:  game.game,
				Seeds: games.Seeds{Server: "verify_bench_server", Client: "verify_bench_client"},
				Nonce: 12345,
				Params: map[string]any{},
			}

			body, err := json.Marshal(request)
			if err != nil {
				b.Fatalf("Failed to marshal request: %v", err)
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				req := httptest.NewRequest("POST", "/verify", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()

				server.Routes().ServeHTTP(w, req)

				if w.Code != http.StatusOK {
					b.Fatalf("Verify request failed: status %d", w.Code)
				}
			}
		})
	}
}