---
inclusion: always
---

# Provable Fairness Implementation Guide

## Core Cryptographic Requirements

**HMAC-SHA256 Only**: Never implement custom cryptographic functions. Use standard HMAC-SHA256 with the exact input format: `${clientSeed}:${nonce}:${currentRound}`

**Server Seed Handling**: Server seeds are treated as ASCII strings, not hex-decoded values. This is critical for bit-for-bit reproducibility.

**4-Byte Float Precision**: Each game outcome uses exactly 4 bytes converted to float64. This ensures deterministic results across platforms.

## RNG Architecture Patterns

**Cursor Management**: 
- Cursor starts at 0 and increments by 32-byte rounds
- Games requiring >8 floats (32 bytes ÷ 4 bytes) use cursor advancement
- Single-round games (Dice, Limbo, Wheel) use cursor=0

**Byte-to-Float Conversion**:
```go
// Standard conversion pattern - use exactly this algorithm
func bytesToFloat(bytes [4]byte) float64 {
    result := 0.0
    for i, b := range bytes {
        divider := math.Pow(256, float64(i+1))
        result += float64(b) / divider
    }
    return result
}
```

## Game Implementation Standards

**Interface Compliance**: All games must implement:
```go
type Game interface {
    Evaluate(floats []float64) (metric float64, details interface{})
    FloatsNeeded() int
    MetricName() string
}
```

**Float-to-Outcome Mapping**:
- Simple games: `outcome = Math.floor(float * possibleOutcomes)`
- Probability-based: Use cumulative distribution tables
- Shuffle-required: Implement Fisher-Yates for non-duplicate outcomes

**Game Categories by Float Requirements**:
- **Single Float**: Dice, Limbo, Wheel, Cases, Darts
- **Multiple Floats**: Keno (10), Mines (24), Plinko (8-16), Cards (unlimited)
- **Weighted Selection**: Bars, Packs, Wheel variants

## Deterministic Behavior Rules

**No Randomization**: Never use `math/rand` or system entropy. All randomness comes from HMAC output.

**Consistent Ordering**: Game events must be generated in the same order every time for identical inputs.

**Precision Handling**: Use consistent rounding and truncation. For Limbo: `Math.max(Math.floor(crashPoint * 100) / 100, 1.0)`

## Performance Optimization

**Allocation-Free Hot Paths**: Pre-allocate byte slices and reuse buffers in scanning operations.

**Worker Pool Pattern**: Use bounded goroutine pools with `GOMAXPROCS` workers for parallel scanning.

**Batch Processing**: Process nonce ranges in chunks to minimize memory allocation overhead.

## Testing Requirements

**Golden Vectors**: Every game must have test vectors with known seed inputs and expected outputs stored in `testdata/`.

**Bit-for-Bit Reproducibility**: Results must be identical across different machines and Go versions.

**Benchmark Coverage**: Include performance tests to detect regressions in high-throughput scanning.

## Error Handling Patterns

**Input Validation**: Validate seeds, nonces, and game parameters at API boundaries before processing.

**Graceful Degradation**: Handle edge cases (empty results, invalid ranges) without panicking.

**Context Cancellation**: Respect context timeouts in long-running scan operations.