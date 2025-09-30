---
inclusion: always
---

# Project Structure & Code Organization

## Architecture Overview

**Stake PF Replay Desktop** is a Wails application with integrated backend replay engine and live bet ingest capabilities:

1. **Wails Desktop Host** (root directory): Main application with embedded HTTP server for live ingest
2. **Backend Replay Engine** (`backend/` directory): Imported Go module providing deterministic scanning and run history
3. **Live Ingest System** (`internal/livehttp/`, `internal/livestore/`): HTTP endpoints and SQLite storage for real-time bet streams

**Critical Rule**: Backend module is imported via `replace` directive in root `go.mod`. Use Wails bindings for frontend communication, not direct HTTP calls.

## Repository Layout

```
project-root/
├── main.go, wails.json            # Wails desktop app entry point
├── go.mod, go.sum                 # Desktop app dependencies (imports backend via replace)
├── frontend/                      # React + TypeScript + Mantine UI
│   ├── src/
│   │   ├── components/            # Shared UI components (tables, forms, layout)
│   │   ├── hooks/                 # React Query hooks (useBetsStream, etc.)
│   │   ├── lib/                   # Client utilities and Wails bridge helpers
│   │   ├── pages/                 # Routed screens (scan, runs, live streams)
│   │   ├── styles/                # Global CSS and theme overrides
│   │   └── components/ui/         # shadcn UI primitives
│   ├── wailsjs/                   # Generated Wails bindings (commit these)
│   └── package.json               # Frontend dependencies
├── backend/                       # Replay engine Go module
│   ├── internal/                  # Core business logic
│   │   ├── api/                   # HTTP handlers for standalone mode
│   │   ├── engine/                # HMAC-SHA256 and RNG functions
│   │   ├── games/                 # Game implementations (Limbo, etc.)
│   │   ├── scan/                  # High-performance scanning with worker pools
│   │   └── store/                 # SQLite database layer
│   ├── migrations/                # Database schema migrations
│   └── go.mod, go.sum            # Backend module dependencies
├── internal/
│   ├── livehttp/                  # Live ingest HTTP server and Wails bindings
│   └── livestore/                 # SQLite store for live bet streams
├── build/                         # Wails build artifacts
└── docs/                         # Project documentation
```

## Architecture Decision Rules

**Wails Desktop Host** (root directory):
- Main application entry point (`main.go`)
- Live ingest HTTP server (`internal/livehttp/`)
- Wails bindings that bridge backend functionality to frontend
- Desktop-specific features and native OS integration

**Backend Replay Engine** (`backend/` directory):
- Deterministic scanning and game evaluation
- Run history and persistence
- Cryptographic functions (HMAC-SHA256)
- Can run standalone for testing but primarily imported by desktop host

**Frontend** (`frontend/` directory):
- React + TypeScript with Mantine UI v7
- Virtualized tables using TableVirtuoso for performance
- Real-time updates via Wails events (`runtime.EventsEmit`)
- Never use fetch() - always use generated Wails bindings

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
- **Wails app code**: Root directory (`main.go`)
- **Live ingest**: `internal/livehttp/` (HTTP server), `internal/livestore/` (SQLite store)
- **Backend games**: `backend/internal/games/{game_name}.go`
- **Frontend pages**: `frontend/src/pages/` (ScanForm, RunDetailsPage, LiveStreamsListPage, etc.)
- **Frontend components**: `frontend/src/components/` (RunsTable, HitsTable, LiveBetsTable)
- **React hooks**: `frontend/src/hooks/` (useBetsStream, etc.)
- **UI primitives**: `frontend/src/components/ui/` (shadcn components)
- **Database migrations**: `backend/migrations/YYYYMMDD_description.sql`
- **Tests**: `*_test.go` alongside source files
- **Wails bindings**: Auto-generated in `frontend/wailsjs/` (commit these for consistency)
- **Build artifacts**: `build/` (Wails output)

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
// Wails bindings in internal/livehttp (bridge backend to frontend)
func (s *Service) StartScan(ctx context.Context, req ScanRequest) (*ScanResult, error) {
    // Use Wails context for cancellation
    // Return structs with proper JSON tags for frontend
}

// Live events for real-time updates
runtime.EventsEmit(ctx, "live-bet-received", bet)

// Frontend communication (never use fetch() - use generated bindings)
import { StartScan, ListStreams } from '../wailsjs/go/internal/livehttp/Service'
import { EventsOn } from '../wailsjs/runtime/runtime'
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
# Wails development (hot reload desktop app with Vite dev server)
wails dev

# Wails production build
wails build

# Backend module development (for testing in isolation)
make -C backend dev        # fmt, lint, test, build
make -C backend run        # start standalone API server
make -C backend test       # run Go tests

# Frontend development (when needed separately)
npm --prefix frontend install
npm --prefix frontend run build

# Dependencies
go mod download
npm --prefix frontend install
```

### File Watching Rules
- **Wails**: Watches root Go files and `frontend/src/`
- **Backend Air**: Watches `backend/cmd/` and `backend/internal/`
- **Never watch**: `node_modules/`, `build/`, `tmp/`, `bin/`

## Configuration Management

### Live Ingest HTTP Endpoints
- `POST /live/ingest`: Accept bets from external senders (optional `X-Ingest-Token`)
- `GET /live/streams`: List streams with bet aggregates
- `GET /live/streams/:id/bets`: Paginated history (nonce_desc, min_multiplier filters)
- `GET /live/streams/:id/tail`: Fetch bets with `id > since_id` for streaming
- `GET /live/streams/:id/export.csv`: CSV export of all bets

### Wails Configuration
- `wails.json`: Build settings, frontend Vite configuration
- Context passed to all Wails methods for cancellation
- Live events via `runtime.EventsEmit` for real-time UI updates
- Generated bindings mirror HTTP endpoints (`ListStreams`, `GetBetsPage`, `Tail`)

## Critical File Organization Rules

### Never Commit These Files
- `*.db` (SQLite databases)
- `build/` (Wails build output)
- `frontend/dist/` (Vite build output)
- `node_modules/` (npm dependencies)
- `tmp/`, `bin/` (temporary build artifacts)

### Always Version These Files
- `backend/migrations/*.sql` (database schema)
- `frontend/wailsjs/` (generated Wails bindings - commit for consistency)
- All `go.mod` and `package.json` files
- Configuration files (`wails.json`, `tsconfig.json`, `frontend/src/theme.ts`)

## Frontend-Specific Patterns

### UI Framework Stack
- **Mantine UI v7**: Primary component library with theme overrides in `frontend/src/theme.ts`
- **shadcn/ui**: Utility components in `frontend/src/components/ui/`
- **TableVirtuoso**: Virtualized tables for performance (RunsTable, HitsTable, LiveBetsTable)
- **React Query**: Server state management via custom hooks in `frontend/src/hooks/`

### Live Data Patterns
```typescript
// Real-time updates via Wails events
EventsOn('live-bet-received', (bet) => {
  // Update UI state, trigger re-renders
})

// Virtualized infinite scroll for large datasets
<TableVirtuoso
  data={bets}
  itemContent={(index, bet) => <BetRow bet={bet} />}
  followOutput="smooth"
/>

// Paginated API calls with server-side filtering
const { data } = useBetsStream(streamId, { minMultiplier: 2.0 })
```