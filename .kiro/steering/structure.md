---
inclusion: always
---

# Project Structure & Code Organization

## Repository Layout

```
engine/
├── .air.toml                   # Air hot-reload configuration
├── API.md                      # Detailed API documentation
├── Makefile                    # Build automation
├── README.md                   # Setup and usage instructions
├── go.mod & go.sum            # Go dependencies
├── data.db*                   # SQLite database files
├── bin/
│   └── pf-service.exe         # Production build
├── cmd/
│   └── pf-service/            # Main service entry point
│       └── main.go
├── internal/                  # Private Go packages
│   ├── api/                   # HTTP handlers & routing
│   ├── engine/                # Core RNG & cryptographic functions
│   ├── games/                 # Game-specific implementations
│   ├── scan/                  # High-performance scanning engine
│   └── store/                 # Database layer
├── migrations/                # Database schema migrations
└── tmp/                       # Air build artifacts (auto-generated)
```

## Package Architecture

**Core Structure**: All business logic lives in `internal/` packages:
- `internal/engine/` - HMAC-SHA256 and float generation (cryptographic core)
- `internal/games/` - Game implementations (one file per game: limbo.go, dice.go, pump.go, roulette.go)
- `internal/scan/` - Worker pools and high-performance scanning
- `internal/api/` - HTTP handlers and routing
- `internal/store/` - Database access layer

**Entry Points**: `cmd/pf-service/` contains only main.go and minimal setup

## Mandatory Patterns

### Game Implementation
Every game MUST implement this exact interface:
```go
type Game interface {
    Evaluate(floats []float64) (metric float64, details interface{})
    FloatsNeeded() int
    MetricName() string
}
```

### File Placement Rules
- New games: `internal/games/{game_name}.go`
- Migrations: `migrations/YYYYMMDD_description.sql`
- Tests: `*_test.go` alongside source files
- Build artifacts: `bin/` for production, `tmp/` for development

### Import Order (Strictly Enforced)
```go
import (
    // 1. Standard library
    "context"
    "fmt"
    
    // 2. Third-party packages
    "github.com/go-chi/chi/v5"
    
    // 3. Internal packages (relative imports)
    "internal/engine"
    "internal/games"
)
```

## Code Style Requirements

### Naming Conventions
- Go files: `snake_case.go` (e.g., `game_engine.go`)
- Functions: `PascalCase` for exported, `camelCase` for private
- Constants: `SCREAMING_SNAKE_CASE`
- Interfaces: Single responsibility, often ending in `-er`

### Error Handling Pattern
```go
// Always wrap errors with context
if err != nil {
    return fmt.Errorf("scanning nonce %d: %w", nonce, err)
}

// Validate at boundaries
func (h *Handler) ScanEndpoint(w http.ResponseWriter, r *http.Request) {
    // Validate ALL inputs before processing
    if req.StartNonce < 0 {
        http.Error(w, "invalid start nonce", http.StatusBadRequest)
        return
    }
}
```

### Testing Requirements
- Golden test cases embedded in test files (deterministic seed → expected outcome)
- Benchmark tests for performance-critical paths
- Property tests for cryptographic functions
- Integration tests for API endpoints

## Performance Patterns

### Worker Pool Usage
```go
// Use GOMAXPROCS-sized pools for CPU-bound work
workers := runtime.GOMAXPROCS(0)
pool := scan.NewWorkerPool(workers)
```

### Memory Management
- Pre-allocate slices in hot paths
- Reuse byte buffers for HMAC operations
- Avoid allocations in scanning loops

## Development Workflow

### Hot Reload with Air
- Use `air` for development with automatic rebuilds
- Configuration in `.air.toml` builds to `tmp/pf-service.exe`
- Watches `cmd/` and `internal/` directories for changes
- Excludes test files and build artifacts

### Build Targets
- **Development**: `air` → `tmp/pf-service.exe` (hot reload)
- **Production**: `make build` → `bin/pf-service.exe` (optimized)
- **Testing**: `make test` (runs all test suites)

## Configuration Conventions

- Environment variables: Database URLs, ports, feature flags
- JSON files: Payout tables, game configurations (loaded once at startup)
- Build tags: `//go:build dev` for development-only code

## File Organization Rules

### Executable Placement
- Production builds: `bin/pf-service.exe`
- Development builds: `tmp/pf-service.exe` (managed by Air)
- Never commit executables to version control

### Database Files
- Development: `data.db` (SQLite, gitignored)
- Migrations: `migrations/*.sql` (versioned)
- Schema changes: Always create new migration files