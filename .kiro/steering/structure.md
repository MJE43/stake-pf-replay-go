# Project Structure & Organization

## Repository Layout

```
/
├── .kiro/                    # Kiro IDE configuration
├── cmd/                      # Go application entry points
│   └── pf-service/          # Main service binary
├── internal/                 # Private Go packages
│   ├── engine/              # Core RNG and float generation
│   ├── games/               # Game-specific implementations
│   ├── scan/                # Worker pool and scanning logic
│   ├── api/                 # HTTP handlers and routing
│   └── store/               # Database access layer
├── migrations/              # Database schema migrations
├── testdata/                # Golden test vectors
├── web/                     # Next.js frontend (future)
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   └── lib/                 # Shared utilities
├── go.mod                   # Go module definition
├── PRD.md                   # Product requirements
├── techstack.md             # Technical specifications
└── stakeDocs.md             # Stake's provable fairness docs
```

## Go Package Organization

### Core Principles
- **internal/**: All business logic is private to this module
- **cmd/**: Only contains main.go files and minimal setup
- **Separation of Concerns**: Each package has a single responsibility

### Package Responsibilities

**engine/**: Core cryptographic operations
- HMAC-SHA256 implementation
- Byte-to-float conversion (4 bytes per float)
- Cursor management for multi-round games

**games/**: Game-specific logic
- Each game in its own file (limbo.go, dice.go, etc.)
- Implements common interface: `Evaluate(floats) (metric, details)`
- Payout tables loaded from JSON files

**scan/**: High-performance scanning
- Worker pool management
- Target rule evaluation (>=, ==, etc.)
- Result aggregation and summaries

**api/**: HTTP interface
- REST endpoints (/scan, /verify, /games)
- Request validation and response formatting
- Error handling and timeouts

**store/**: Data persistence
- Database schema and migrations
- Run and hit storage
- SQLite/PostgreSQL abstraction

## File Naming Conventions

- **Go files**: lowercase with underscores (e.g., `game_engine.go`)
- **Test files**: `*_test.go` suffix
- **Golden test data**: `testdata/game_name_vectors.json`
- **Migration files**: `YYYYMMDD_description.sql`

## Code Organization Rules

### Game Implementation Pattern
Each game must implement:
```go
type Game interface {
    Evaluate(floats []float64) (metric float64, details interface{})
    FloatsNeeded() int
    MetricName() string
}
```

### Error Handling
- Use wrapped errors with context
- Validate inputs at API boundaries
- Fail fast on configuration errors

### Testing Strategy
- **Golden vectors**: Fixed seed inputs → expected outputs
- **Property tests**: Verify deterministic behavior
- **Benchmark tests**: Performance regression detection

## Configuration Management

- **Environment variables**: Database connections, ports
- **JSON files**: Payout tables, game configurations
- **Build flags**: Development vs production builds

## Import Organization

Standard Go import order:
1. Standard library
2. Third-party packages
3. Internal packages (relative imports)