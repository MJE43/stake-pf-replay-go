# Implementation Plan

- [x] 1. Implement core RNG engine with golden test validation





  - Create HMAC-SHA256 based float generation with exact 4-byte conversion
  - Implement cursor management for multi-round HMAC generation
  - Add comprehensive golden test vectors covering edge cases
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Create core RNG types and interfaces


  - Define Seeds struct and core function signatures
  - Implement Floats() and FloatsInto() functions with proper cursor handling
  - Create ByteGenerator for streaming approach
  - _Requirements: 1.1, 1.6_

- [x] 1.2 Implement HMAC-SHA256 byte generation


  - Create byte generator that handles cursor advancement across 32-byte boundaries
  - Implement exact message format: `${clientSeed}:${nonce}:${currentRound}`
  - Ensure server seed is treated as ASCII string (never hex-decoded)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.3 Implement 4-byte to float conversion


  - Create exact conversion using formula: b0/256 + b1/256² + b2/256³ + b3/256⁴
  - Ensure deterministic results across platforms and Go versions
  - Add unit tests for conversion accuracy
  - _Requirements: 1.6_

- [x] 1.4 Create comprehensive golden test vectors


  - Generate reference vectors using Node.js script for cross-platform validation
  - Test cursor=0 with count=8 (single HMAC block)
  - Test cursor=31 with count=2 (boundary crossing)
  - Test count=40 (multiple rounds)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.5 Add RNG performance benchmarks


  - Benchmark single float generation
  - Benchmark batch float generation (8, 40 floats)
  - Benchmark cursor boundary crossing scenarios
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement game interface and core game engines




  - Define Game interface with Evaluate, FloatCount, and Spec methods
  - Implement Limbo game with exact crash point calculation
  - Implement Dice game with continuous roll calculation
  - Implement Roulette game with integer pocket calculation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2.1 Define game interface and common types


  - Create Game interface with updated signatures using Seeds and map[string]any
  - Define GameResult, GameSpec, and related types
  - Create game registry mechanism for discovery
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 2.2 Implement Limbo game engine


  - Create LimboGame struct implementing Game interface
  - Implement exact crash point calculation with house edge support
  - Add FloatCount() returning 1 and proper Spec() metadata
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.3 Implement Dice game engine


  - Create DiceGame struct with continuous roll calculation
  - Use formula: (float * 10001) / 100 for 0.00-100.00 range
  - Handle edge cases and precision appropriately
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.4 Implement Roulette game engine


  - Create RouletteGame struct for European roulette (0-36)
  - Use formula: floor(float * 37) for pocket calculation
  - Return pocket as float64 metric but integer in details
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.5 Add golden test vectors for all games


  - Create game-specific test vectors with known inputs/outputs
  - Test Limbo with various house edge values and edge cases
  - Test Dice with boundary values and precision
  - Test Roulette with all 37 possible pockets
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement high-performance scanning system





  - Create worker pool with bounded goroutines (GOMAXPROCS)
  - Implement target evaluation with tolerance handling
  - Add result aggregation with summary statistics
  - Optimize for zero-allocation hot paths
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3.1 Create scanning worker pool architecture


  - Implement ScanWorker struct with job/result channels
  - Create bounded worker pool using GOMAXPROCS
  - Design job batching for optimal throughput (4-16k nonce ranges)
  - _Requirements: 6.1, 6.3_

- [x] 3.2 Implement target evaluation system

  - Create TargetEvaluator with support for all comparison operations
  - Implement tolerance handling with defaults (1e-9 for floats, 0 for integers)
  - Add support for "between", "outside", and other range operations
  - _Requirements: 6.3_

- [x] 3.3 Create result aggregation and summary statistics

  - Implement Hit collection with nonce and metric only
  - Calculate summary statistics (count, min, max, mean)
  - Handle hit limits and timeout conditions gracefully
  - _Requirements: 6.4, 6.5_

- [x] 3.4 Optimize memory allocation in hot paths


  - Use sync.Pool for float slice buffer reuse
  - Avoid JSON marshaling in worker loops
  - Pre-allocate result slices based on expected hit rates
  - _Requirements: 6.2_

- [x] 3.5 Add scanning performance benchmarks


  - Benchmark worker pool with various nonce ranges
  - Test memory allocation patterns under load
  - Verify linear scaling with CPU cores
  - _Requirements: 6.1, 6.2_

- [x] 4. Implement HTTP API with request/response handling





  - Create REST endpoints for scan, verify, games, and seed hashing
  - Add input validation and error handling
  - Implement request echoing and version information
  - Add timeout and cancellation support
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4.1 Create HTTP API structure and routing


  - Set up chi router with proper middleware
  - Define API endpoints: POST /scan, POST /verify, GET /games, POST /seed/hash
  - Add request logging and error handling middleware
  - _Requirements: 7.4, 7.5_

- [x] 4.2 Implement scan endpoint with full request handling


  - Create ScanRequest/ScanResult types with proper validation
  - Implement request parsing and parameter validation
  - Add timeout handling with context cancellation
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 4.3 Implement verify endpoint for single nonce verification


  - Create endpoint for detailed single nonce evaluation
  - Return full GameResult with details for debugging
  - Include engine version and input echo
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 4.4 Implement games metadata endpoint


  - Return list of supported games with specs
  - Include parameter schemas and metric information
  - Add version information for table-driven games
  - _Requirements: 7.2, 7.3_

- [x] 4.5 Implement seed hashing endpoint


  - Create endpoint to return sha256(serverSeed) for verification
  - Add proper error handling for invalid inputs
  - Include security logging without exposing raw seeds
  - _Requirements: 7.4, 7.5_

- [x] 5. Add comprehensive error handling and logging





  - Implement structured error types with context
  - Add security-conscious logging (no raw seeds)
  - Create proper error responses with debugging information
  - Add monitoring and observability features

  - _Requirements: 7.4, 7.5_

- [x] 5.1 Create structured error handling system

  - Define EngineError types with proper categorization
  - Implement error wrapping with context information
  - Add input validation at API boundaries
  - _Requirements: 7.4_

- [x] 5.2 Implement security-conscious logging


  - Log sha256(server) and client seed hashes only
  - Include game, params, nonce ranges, and engine version in logs
  - Never log raw server/client seeds in any context
  - _Requirements: 7.5_

- [x] 5.3 Add monitoring and health check endpoints


  - Implement health check endpoint for service status
  - Add basic metrics collection for scan performance
  - Create structured logging for debugging and monitoring
  - _Requirements: 7.5_

- [x] 6. Create integration tests and end-to-end validation





  - Test complete scan workflows with realistic data
  - Validate cross-platform reproducibility
  - Add performance regression tests
  - Create comprehensive test coverage
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6.1 Create end-to-end integration tests


  - Test complete scan workflow from HTTP request to response
  - Validate all game types with various parameter combinations
  - Test timeout and limit handling in realistic scenarios
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6.2 Add cross-platform reproducibility tests


  - Verify identical results across different architectures
  - Test with different GOMAXPROCS settings
  - Validate against Node.js reference implementation
  - _Requirements: 2.4, 2.5_


- [x] 6.3 Create performance regression test suite

  - Benchmark full scanning pipeline with 1M+ nonces
  - Test memory usage patterns under sustained load
  - Verify linear scaling with CPU cores
  - _Requirements: 6.1, 6.2_