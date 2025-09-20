---
inclusion: always
---

# Technology Stack & Development Guidelines

## Architecture Overview

This is a **Wails desktop application** with dual architecture:
- **Desktop App**: Wails v2 framework (Go backend + frontend bundled as native app)
- **Standalone Backend**: Go HTTP service for high-performance HMAC calculations

**Key Constraint**: When working with Wails components, use Wails-specific patterns and APIs. For backend-only features, use standard Go HTTP patterns.

## Go Backend Requirements

### Mandatory Stack
- **Go Version**: 1.22+ (required for Wails v2 compatibility)
- **HTTP Framework**: chi router with net/http
- **Database**: SQLite with modernc.org/sqlite driver
- **Migrations**: goose for schema management
- **Concurrency**: Worker pools sized to GOMAXPROCS

### Required Dependencies
```go
github.com/go-chi/chi/v5        // HTTP routing
github.com/pressly/goose/v3     // Database migrations  
modernc.org/sqlite              // SQLite driver (CGO-free)
github.com/google/uuid          // UUID generation
github.com/wailsapp/wails/v2    // Desktop app framework
```

### Build Commands (Use These Exactly)
```bash
# Wails development (hot reload)
wails dev

# Wails production build
wails build

# Backend-only development
cd backend && air

# Backend-only build
cd backend && go build -o bin/pf-service ./cmd/pf-service

# Run tests with race detection
go test -race -v ./...

# Database migrations
cd backend && goose -dir migrations sqlite3 ./data.db up
```

## Frontend Guidelines

### Stack Requirements
- **Framework**: React 18 with TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: TanStack Query for server state, Zustand for client state
- **Validation**: Zod schemas for all API boundaries
- **Charts**: Recharts for data visualization

### Wails Integration Rules
- Use `@wailsjs/go` imports for backend communication
- Never use fetch() for backend calls - use generated Wails bindings
- Handle context cancellation in long-running operations
- Use Wails events for real-time updates

## Performance Standards

### Critical Requirements
- **Scanning Performance**: Must handle 1M+ nonce evaluations per hour
- **Memory Management**: Zero allocations in hot scanning paths
- **Concurrency**: Use runtime.GOMAXPROCS() for worker pool sizing
- **Determinism**: Identical inputs must produce identical outputs

### Code Patterns to Follow
```go
// Worker pool pattern (required for scanning)
workers := runtime.GOMAXPROCS(0)
pool := scan.NewWorkerPool(workers)

// Pre-allocate slices in hot paths
results := make([]ScanResult, 0, expectedSize)

// Reuse buffers for HMAC operations
var hmacBuf [32]byte
```

## Cryptographic Requirements (Non-Negotiable)

### HMAC Implementation Rules
- **Algorithm**: HMAC-SHA256 only - never implement custom crypto
- **Input Format**: Exactly `${clientSeed}:${nonce}:${currentRound}`
- **Server Seed**: Treat as ASCII string, never hex-decode
- **Float Precision**: Use exactly 4 bytes per float for deterministic results

### Byte-to-Float Conversion (Use This Exact Algorithm)
```go
func bytesToFloat(bytes [4]byte) float64 {
    result := 0.0
    for i, b := range bytes {
        divider := math.Pow(256, float64(i+1))
        result += float64(b) / divider
    }
    return result
}
```

## Development Workflow

### File Structure Rules
- Wails app code: Root directory (`app.go`, `main.go`)
- Backend service: `backend/` directory (can run standalone)
- Frontend: `frontend/` directory
- Shared types: Use Wails struct tags for frontend binding

### Testing Requirements
- Golden test vectors for all cryptographic functions
- Benchmark tests for performance-critical scanning code
- Integration tests for Wails context binding
- Property tests for deterministic behavior

### Error Handling Pattern
```go
// Always wrap errors with context
if err != nil {
    return fmt.Errorf("scanning nonce %d: %w", nonce, err)
}

// Validate at API boundaries
func (a *App) ScanNonces(ctx context.Context, req ScanRequest) error {
    if req.StartNonce < 0 {
        return fmt.Errorf("invalid start nonce: %d", req.StartNonce)
    }
    // Process...
}
```

## AI Assistant Guidelines

When modifying this codebase:
1. **Check context**: Determine if working with Wails app or standalone backend
2. **Use exact patterns**: Follow the cryptographic and performance patterns above
3. **Maintain determinism**: Never introduce randomness or platform-specific behavior
4. **Test thoroughly**: Include golden vectors for any cryptographic changes
5. **Respect architecture**: Don't mix Wails and HTTP patterns inappropriately