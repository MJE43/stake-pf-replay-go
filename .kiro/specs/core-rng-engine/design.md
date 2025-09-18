# Design Document

## Overview

The Core RNG Engine implements the cryptographic foundation for Stake PF Replay, providing deterministic random number generation that exactly matches Stake's provable fairness specification. The design follows a layered architecture with the RNG engine at the core, game-specific implementations above it, and a high-performance scanning system that can process millions of nonces efficiently.

The system is designed around the principle of "boring crypto is good crypto" - using only standard HMAC-SHA256 with exact byte-to-float conversion as specified in Stake's documentation. All operations must be deterministic and bit-for-bit reproducible across different machines and Go versions.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Scanning Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Worker Pool    │  │  Result Agg     │  │  Target Eval │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Game Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │     Limbo       │  │      Dice       │  │   Roulette   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     RNG Engine                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  HMAC Generator │  │  Byte→Float     │  │ Cursor Mgmt  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Package Structure

- **`internal/engine`**: Core RNG implementation, byte-to-float conversion, cursor management
- **`internal/games`**: Game-specific implementations (limbo, dice, roulette)
- **`internal/scan`**: High-performance worker pool and result aggregation
- **`internal/api`**: HTTP handlers and request/response formatting
- **`testdata/`**: Golden test vectors for all games

## Components and Interfaces

### RNG Engine Core

```go
// Core RNG function signature
func Floats(serverSeed, clientSeed string, nonce uint64, cursor uint64, count int) []float64

// Allocation-free version that fills existing buffer
func FloatsInto(dst []float64, serverSeed, clientSeed string, nonce uint64, cursor uint64, count int) []float64

// Byte generator for streaming approach (optional)
type ByteGenerator struct {
    serverSeed   string
    clientSeed   string
    nonce        uint64
    currentRound uint64
    currentPos   int
    buffer       [32]byte
}

func (bg *ByteGenerator) Next() byte
func (bg *ByteGenerator) NextFloat() float64
```

**Key Design Decisions:**
- Server seed treated as ASCII string (never hex-decoded)
- HMAC message format: `${clientSeed}:${nonce}:${currentRound}`
- Exact 4-byte to float conversion: `b0/256 + b1/256² + b2/256³ + b3/256⁴`
- Cursor management handles crossing 32-byte HMAC boundaries

### Game Interface

```go
type Game interface {
    // Evaluate a single nonce and return metric + details
    Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error)
    
    // Number of floats needed for this game
    FloatCount(params map[string]any) int
    
    // Metadata about this game
    Spec() GameSpec
}

type GameResult struct {
    Metric      float64 `json:"metric"`
    MetricLabel string  `json:"metric_label"`
    Details     any     `json:"details,omitempty"`
}

type GameSpec struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    MetricLabel string `json:"metric_label"`
}
```

### Scanning System

```go
type ScanRequest struct {
    Game       string         `json:"game"`
    Seeds      Seeds          `json:"seeds"`
    NonceStart uint64         `json:"nonce_start"`
    NonceEnd   uint64         `json:"nonce_end"`
    Params     map[string]any `json:"params"`
    TargetOp   string         `json:"target_op"` // "ge", "le", "eq", "gt", "lt", "between", "outside"
    TargetVal  float64        `json:"target_val"`
    TargetVal2 float64        `json:"target_val2,omitempty"` // for "between" and "outside"
    Tolerance  float64        `json:"tolerance"`              // default 1e-9 for floats, 0 for integers
    Limit      int            `json:"limit,omitempty"`
    TimeoutMs  int            `json:"timeout_ms,omitempty"`
}

type ScanResult struct {
    Hits          []Hit                  `json:"hits"`
    Summary       Summary                `json:"summary"`
    EngineVersion string                 `json:"engine_version"`
    Echo          ScanRequest            `json:"echo"`
}
```

## Data Models

### Seeds Structure
```go
type Seeds struct {
    Server string `json:"server"`
    Client string `json:"client"`
}
```

### Hit and Summary Models
```go
type Hit struct {
    Nonce  uint64  `json:"nonce"`
    Metric float64 `json:"metric"`
}

type Summary struct {
    TotalEvaluated uint64  `json:"total_evaluated"`
    HitsFound      int     `json:"hits_found"`
    MinMetric      float64 `json:"min_metric"`
    MaxMetric      float64 `json:"max_metric"`
    MeanMetric     float64 `json:"mean_metric"`
    TimedOut       bool    `json:"timed_out,omitempty"`
}
```

### Golden Test Vector Format
```go
type RNGVector struct {
    Description string    `json:"description"`
    ServerSeed  string    `json:"server_seed"`
    ClientSeed  string    `json:"client_seed"`
    Nonce       uint64    `json:"nonce"`
    Cursor      int       `json:"cursor"`
    Count       int       `json:"count"`
    Expected    []float64 `json:"expected"`
}

type GameVector struct {
    Description string         `json:"description"`
    ServerSeed  string         `json:"server_seed"`
    ClientSeed  string         `json:"client_seed"`
    Nonce       uint64         `json:"nonce"`
    Params      map[string]any `json:"params"`
    Expected    GameResult     `json:"expected"`
}
```

## Error Handling

### Error Types
```go
type EngineError struct {
    Type    string `json:"type"`
    Message string `json:"message"`
    Context map[string]interface{} `json:"context,omitempty"`
}

const (
    ErrInvalidSeed   = "invalid_seed"
    ErrInvalidNonce  = "invalid_nonce"
    ErrInvalidParams = "invalid_params"
    ErrGameNotFound  = "game_not_found"
    ErrTimeout       = "timeout"
)
```

### Error Handling Strategy
- Validate all inputs at API boundaries before processing
- Use wrapped errors with context for debugging
- Fail fast on configuration errors
- Graceful degradation for timeouts (return partial results)
- Never panic in production code paths

## Testing Strategy

### Golden Test Implementation

**RNG Golden Tests:**
```go
func TestRNGGoldenVectors(t *testing.T) {
    vectors := loadRNGVectors("testdata/rng_golden.json")
    for _, v := range vectors {
        t.Run(v.Description, func(t *testing.T) {
            actual := Floats(v.ServerSeed, v.ClientSeed, v.Nonce, v.Cursor, v.Count)
            assertFloatsEqual(t, v.Expected, actual, 1e-12) // Cross-platform tolerance
        })
    }
}

// Test cursor boundary crossing
func TestRNGCursorBoundary(t *testing.T) {
    // cursor=31, count=2 forces crossing into next HMAC block
    floats := Floats("test_server", "test_client", 1, 31, 2)
    assert.Len(t, floats, 2)
}

// Test multi-round generation
func TestRNGMultiRound(t *testing.T) {
    // count=40 requires multiple HMAC rounds
    floats := Floats("test_server", "test_client", 1, 0, 40)
    assert.Len(t, floats, 40)
}
```

**Game Golden Tests:**
```go
func TestLimboGoldenVectors(t *testing.T) {
    vectors := loadGameVectors("testdata/limbo_vectors.json")
    limbo := &LimboGame{}
    
    for _, v := range vectors {
        t.Run(v.Description, func(t *testing.T) {
            result, err := limbo.Evaluate(Seeds{v.ServerSeed, v.ClientSeed}, v.Nonce, v.Params)
            require.NoError(t, err)
            
            assert.InDelta(t, v.Expected.Metric, result.Metric, 1e-9)
        })
    }
}
```

### Performance Testing
- Benchmark RNG generation for single and batch operations
- Benchmark game evaluation in isolation
- Benchmark full scanning pipeline with realistic nonce ranges
- Memory allocation profiling to ensure zero-allocation hot paths

### Cross-Platform Testing
- Test on different architectures (amd64, arm64)
- Verify identical results across Go versions
- Test with different GOMAXPROCS settings

## Game-Specific Implementations

### Limbo Game Design
```go
type LimboGame struct{}

func (g *LimboGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
    houseEdge := 0.99 // default 1% house edge
    if he, ok := params["houseEdge"].(float64); ok && he > 0 && he <= 1 {
        houseEdge = he
    }
    
    floats := Floats(seeds.Server, seeds.Client, nonce, 0, 1)
    f := floats[0]
    floatPoint := (1e8 / (f * 1e8)) * houseEdge
    crashPoint := math.Floor(floatPoint*100.0) / 100.0
    result := math.Max(crashPoint, 1.0)
    
    return GameResult{
        Metric:      result,
        MetricLabel: "multiplier",
        Details: map[string]any{
            "raw_float":   f,
            "house_edge":  houseEdge,
            "crash_point": result,
        },
    }, nil
}
```

### Dice Game Design
```go
type DiceGame struct{}

func (g *DiceGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
    floats := Floats(seeds.Server, seeds.Client, nonce, 0, 1)
    f := floats[0]
    
    // Continuous roll (0.00 to ~100.00)
    roll := (f * 10001) / 100
    
    return GameResult{
        Metric:      roll,
        MetricLabel: "roll",
        Details: map[string]any{
            "raw_float": f,
            "roll":      roll,
        },
    }, nil
}
```

### Roulette Game Design
```go
type RouletteGame struct{}

func (g *RouletteGame) Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error) {
    floats := Floats(seeds.Server, seeds.Client, nonce, 0, 1)
    f := floats[0]
    pocket := math.Floor(f * 37) // European roulette: 0-36
    
    return GameResult{
        Metric:      pocket, // Keep as float64 for uniformity
        MetricLabel: "pocket",
        Details: map[string]any{
            "raw_float": f,
            "pocket":    int(pocket), // Integer in details
        },
    }, nil
}
```

## Performance Optimizations

### Worker Pool Design
```go
type ScanWorker struct {
    id       int
    jobs     <-chan ScanJob
    results  chan<- Hit
    game     Game
    seeds    Seeds
    params   map[string]interface{}
    targetOp string
    targetVal float64
    tolerance float64
}

type ScanJob struct {
    NonceStart uint64
    NonceEnd   uint64
}
```

**Key Optimizations:**
- One worker per GOMAXPROCS core
- Feed single nonces or small contiguous ranges (4-16k) to amortize scheduling
- No JSON in the hot path; only push {nonce, metric} to result channel
- Pre-allocate per-worker float slice buffers and reuse them via sync.Pool
- Use bounded channels to prevent memory bloat
- Respect timeout and limit in collector; do not stop workers early unless context canceled
- Early termination when hit limits are reached

### Memory Management
- Pool float slice allocations for reuse
- Minimize interface{} usage in hot paths (use any instead)
- Use value types where possible to reduce GC pressure
- Pre-size result slices based on expected hit rates

## Target Evaluation and Tolerance

### Target Operations
```go
type TargetEvaluator struct {
    op        string  // "ge", "le", "eq", "gt", "lt", "between", "outside"
    val1      float64
    val2      float64 // for "between" and "outside"
    tolerance float64
}

func (te *TargetEvaluator) Matches(metric float64) bool {
    switch te.op {
    case "eq":
        return math.Abs(metric-te.val1) <= te.tolerance
    case "ge":
        return metric >= te.val1-te.tolerance
    case "le":
        return metric <= te.val1+te.tolerance
    case "gt":
        return metric > te.val1+te.tolerance
    case "lt":
        return metric < te.val1-te.tolerance
    case "between":
        return metric >= te.val1-te.tolerance && metric <= te.val2+te.tolerance
    case "outside":
        return metric < te.val1-te.tolerance || metric > te.val2+te.tolerance
    default:
        return false
    }
}
```

### Tolerance Defaults
- **Float metrics** (Limbo, Dice): Default tolerance = 1e-9
- **Integer metrics** (Roulette): Default tolerance = 0 (exact matching)
- **Custom tolerance**: User can override via request parameter

## Deployment and Configuration

### Build Configuration
```go
// Version information embedded at build time
var (
    EngineVersion = "dev"
    GitCommit     = "unknown"
    BuildTime     = "unknown"
)

// Echo engine version in all responses
type VersionInfo struct {
    EngineVersion string `json:"engine_version"`
    TableVersion  string `json:"table_version,omitempty"` // For table-driven games
}
```

### Runtime Configuration
```go
type Config struct {
    MaxWorkers    int           `env:"MAX_WORKERS" default:"0"` // 0 = GOMAXPROCS
    MaxNonceRange uint64        `env:"MAX_NONCE_RANGE" default:"10000000"`
    DefaultTimeout time.Duration `env:"DEFAULT_TIMEOUT" default:"60s"`
    MaxHitLimit   int           `env:"MAX_HIT_LIMIT" default:"100000"`
}
```

### Monitoring and Observability
- Structured logging with context (never log raw server/client seeds)
- Log sha256(server) and client seed hash only for debugging
- Include {game, params, nonce_start/end, engine_version} in error context
- Return partial summaries on timeout with timed_out: true flag
- Prometheus metrics for scan performance
- Request tracing for debugging
- Health check endpoints

This design provides a solid foundation for the core RNG engine while maintaining the flexibility to add new games and scale performance as needed. The emphasis on golden tests and deterministic behavior ensures compatibility with Stake's specification.