---
inclusion: always
---

# Project Structure & Code Organization

## Dual Architecture Overview

This project has **two distinct architectures** that must be handled differently:

1. **Wails Desktop App** (root directory): Go backend + React frontend bundled as native desktop app
2. **Standalone Backend Service** (`backend/` directory): Independent Go HTTP service for high-performance operations

**Critical Rule**: When working in root directory, use Wails patterns. When working in `backend/`, use standard Go HTTP patterns.

## Repository Layout

```
project-root/
├── app.go, main.go, wails.json    # Wails desktop app files
├── go.mod, go.sum                 # Wails app dependencies
├── frontend/                      # React + TypeScript frontend
│   ├── src/                       # React components and logic
│   ├── wailsjs/                   # Generated Wails bindings
│   └── package.json               # Frontend dependencies
├── backend/                       # Standalone HTTP service
│   ├── cmd/pf-service/main.go     # HTTP service entry point
│   ├── internal/                  # Service business logic
│   │   ├── api/                   # HTTP handlers & routing
│   │   ├── engine/                # Core RNG & crypto functions
│   │   ├── games/                 # Game implementations
│   │   ├── scan/                  # High-performance scanning
│   │   └── store/                 # Database layer
│   ├── migrations/                # Database schema
│   ├── go.mod, go.sum            # Backend service dependencies
│   └── .air.toml                 # Hot reload config
├── docs/                         # Project documentation
└── build/                        # Build artifacts
```

## Architecture Decision Rules

**When to use Wails app** (root directory):
- Desktop UI interactions
- File system operations
- Cross-platform native features
- User-facing application logic

**When to use Backend service** (`backend/`):
- High-performance scanning operations
- Headless batch processing
- API-only integrations
- Server deployments

## Mandatory Code Patterns

### Game Implementation Interface
Every game MUST implement this exact interface in `backend/internal/games/`:
```go
type Game interface {
    Evaluate(floats []float64) (metric float64, details interface{})
    FloatsNeeded() int
    MetricName() string
}
```

### File Placement Rules (Strictly Enforced)
- **Wails app code**: Root directory (`app.go`, `main.go`)
- **Backend games**: `backend/internal/games/{game_name}.go`
- **Database migrations**: `backend/migrations/YYYYMMDD_description.sql`
- **Tests**: `*_test.go` alongside source files
- **Wails bindings**: Auto-generated in `frontend/wailsjs/`
- **Build artifacts**: `build/` (Wails), `backend/bin/` (service), `backend/tmp/` (dev)

### Import Order (AI Must Follow)
```go
import (
    // 1. Standard library (alphabetical)
    "context"
    "fmt"
    "net/http"
    
    // 2. Third-party packages (alphabetical)
    "github.com/go-chi/chi/v5"
    "github.com/wailsapp/wails/v2/pkg/runtime"
    
    // 3. Internal packages (relative to current module)
    "internal/engine"
    "internal/games"
)
```

### Wails-Specific Patterns
```go
// Wails context methods (use these in app.go)
func (a *App) ScanNonces(ctx context.Context, req ScanRequest) (*ScanResult, error) {
    // Use Wails context for cancellation
    // Return structs with proper JSON tags for frontend
}

// Frontend communication (never use fetch() - use generated bindings)
import { ScanNonces } from '../wailsjs/go/main/App'
```

## Code Style Requirements (AI Must Follow)

### Naming Conventions
- **Go files**: `snake_case.go` (e.g., `game_engine.go`, `limbo_test.go`)
- **Functions**: `PascalCase` for exported, `camelCase` for private
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Interfaces**: Single responsibility, often ending in `-er` (e.g., `Scanner`, `Evaluator`)
- **Wails structs**: Use JSON tags for frontend binding: `json:"fieldName"`

### Error Handling Patterns (Required)
```go
// Backend service - HTTP error responses
func (h *Handler) ScanEndpoint(w http.ResponseWriter, r *http.Request) {
    if req.StartNonce < 0 {
        http.Error(w, "invalid start nonce", http.StatusBadRequest)
        return
    }
}

// Wails app - return errors to frontend
func (a *App) ScanNonces(ctx context.Context, req ScanRequest) (*ScanResult, error) {
    if req.StartNonce < 0 {
        return nil, fmt.Errorf("invalid start nonce: %d", req.StartNonce)
    }
}

// Always wrap errors with context
if err != nil {
    return fmt.Errorf("scanning nonce %d: %w", nonce, err)
}
```

### Testing Requirements (Non-Negotiable)
- **Golden vectors**: Deterministic seed inputs → expected outputs in `testdata/`
- **Benchmark tests**: Performance-critical scanning operations
- **Wails integration tests**: Context binding and frontend communication
- **Property tests**: Cryptographic function determinism

## Performance Patterns (Critical for Scanning)

### Worker Pool Usage (Required Pattern)
```go
// Always use GOMAXPROCS for CPU-bound scanning
workers := runtime.GOMAXPROCS(0)
pool := scan.NewWorkerPool(workers)

// Pre-allocate result slices
results := make([]ScanResult, 0, expectedSize)
```

### Memory Management (Zero-Allocation Hot Paths)
- Pre-allocate slices in scanning loops
- Reuse byte buffers for HMAC operations: `var hmacBuf [32]byte`
- Avoid string concatenation in hot paths
- Use sync.Pool for buffer reuse in high-throughput operations

## Development Workflow (AI Assistant Commands)

### Build Commands (Use These Exactly)
```bash
# Wails development (hot reload both frontend and backend)
wails dev

# Wails production build
wails build

# Backend service development (hot reload)
cd backend && air

# Backend service production build
cd backend && go build -o bin/pf-service ./cmd/pf-service

# Run all tests with race detection
go test -race -v ./...

# Database migrations
cd backend && goose -dir migrations sqlite3 ./data.db up
```

### File Watching Rules
- **Wails**: Watches root Go files and `frontend/src/`
- **Backend Air**: Watches `backend/cmd/` and `backend/internal/`
- **Never watch**: `node_modules/`, `build/`, `tmp/`, `bin/`

## Configuration Management

### Environment Variables (Backend Service)
- `PORT`: HTTP server port (default: 8080)
- `DATABASE_URL`: SQLite file path
- `LOG_LEVEL`: debug, info, warn, error

### Wails Configuration
- `wails.json`: Build settings, frontend commands
- Context passed to all app methods for cancellation
- No environment variables - use app configuration

## Critical File Organization Rules

### Never Commit These Files
- `backend/data.db` (development database)
- `backend/tmp/` (Air build artifacts)
- `backend/bin/` (compiled binaries)
- `build/` (Wails build output)
- `frontend/dist/` (Vite build output)

### Always Version These Files
- `backend/migrations/*.sql` (database schema)
- `frontend/wailsjs/` (generated bindings - commit for consistency)
- All `go.mod` and `package.json` files
- Configuration files (`.air.toml`, `wails.json`, `tsconfig.json`)