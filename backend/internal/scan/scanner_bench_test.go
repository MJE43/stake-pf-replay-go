package scan

import (
	"context"
	"fmt"
	"runtime"
	"testing"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
)

// BenchmarkScannerSmallRange benchmarks scanning a small nonce range
func BenchmarkScannerSmallRange(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   1000,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  2.0,
		Tolerance:  1e-9,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkScannerMediumRange benchmarks scanning a medium nonce range
func BenchmarkScannerMediumRange(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  2.0,
		Tolerance:  1e-9,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkScannerLargeRange benchmarks scanning a large nonce range
func BenchmarkScannerLargeRange(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   100000,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  2.0,
		Tolerance:  1e-9,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkScannerDifferentGames benchmarks different game types
func BenchmarkScannerDice(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{},
		TargetOp:   OpLessEqual,
		TargetVal:  1.0,
		Tolerance:  1e-9,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkScannerRoulette(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "roulette",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{},
		TargetOp:   OpEqual,
		TargetVal:  17.0,
		Tolerance:  0, // Exact matching for roulette
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkWorkerPoolScaling tests performance with different worker counts
func BenchmarkWorkerPoolScaling(b *testing.B) {
	originalGOMAXPROCS := runtime.GOMAXPROCS(0)
	defer runtime.GOMAXPROCS(originalGOMAXPROCS)

	workerCounts := []int{1, 2, 4, 8, 16}
	
	for _, workers := range workerCounts {
		b.Run(fmt.Sprintf("workers-%d", workers), func(b *testing.B) {
			runtime.GOMAXPROCS(workers)
			scanner := NewScanner()
			
			req := ScanRequest{
				Game:       "limbo",
				Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
				NonceStart: 1,
				NonceEnd:   50000,
				Params:     map[string]any{"houseEdge": 0.99},
				TargetOp:   OpGreaterEqual,
				TargetVal:  2.0,
				Tolerance:  1e-9,
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				ctx := context.Background()
				_, err := scanner.Scan(ctx, req)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// BenchmarkMemoryAllocation tests memory allocation patterns
func BenchmarkMemoryAllocation(b *testing.B) {
	scanner := NewScanner()
	req := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   OpGreaterEqual,
		TargetVal:  2.0,
		Tolerance:  1e-9,
	}

	b.ReportAllocs()
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := scanner.Scan(ctx, req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkTargetEvaluator benchmarks the target evaluation system
func BenchmarkTargetEvaluator(b *testing.B) {
	evaluator := NewTargetEvaluator(OpGreaterEqual, 2.0, 0, 1e-9)
	testMetric := 2.5

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = evaluator.Matches(testMetric)
	}
}

// BenchmarkTargetEvaluatorBetween benchmarks the "between" operation
func BenchmarkTargetEvaluatorBetween(b *testing.B) {
	evaluator := NewTargetEvaluator(OpBetween, 1.0, 3.0, 1e-9)
	testMetric := 2.5

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = evaluator.Matches(testMetric)
	}
}

// BenchmarkJobGeneration benchmarks the job generation system
func BenchmarkJobGeneration(b *testing.B) {
	scanner := NewScanner()
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		jobs := make(chan ScanJob, 100)
		ctx := context.Background()
		
		go scanner.generateJobs(ctx, jobs, 1, 100000)
		
		// Consume all jobs
		for job := range jobs {
			_ = job
		}
	}
}