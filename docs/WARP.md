# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a Wails-based desktop application for replaying Stake Originals game outcomes. The application is split into two main parts:

1. **Backend** (`/backend`): High-performance Go service implementing cryptographic game replay using HMAC-SHA256
2. **Frontend** (`/frontend`): React TypeScript UI using Mantine components
3. **Desktop Integration** (`main.go`, `app.go`): Wails bindings that connect backend and frontend

The core purpose is deterministic replay of game outcomes using server seeds (unhashed), client seeds, and nonce ranges to analyze what would have happened in Stake Originals games like Limbo, Dice, Roulette, and Pump.

## Architecture

### Hybrid Architecture Pattern
This project uses a unique hybrid architecture:
- **Standalone Backend**: Complete HTTP API service in `/backend` that can run independently
- **Desktop App**: Wails application that embeds the backend logic via Go modules but exposes it through direct function bindings rather than HTTP calls
- **Shared Logic**: Backend logic is imported as `github.com/MJE43/stake-pf-replay-go` (local module replacement in go.mod)

### Key Components

**Backend Structure** (`/backend`):
- `cmd/pf-service/`: Standalone HTTP service entry point
- `internal/api/`: HTTP handlers, middleware, validation
- `internal/engine/`: Core HMAC-SHA256 RNG implementation following Stake's spec
- `internal/games/`: Game-specific implementations (Limbo, Dice, Roulette, Pump)
- `internal/scan/`: High-performance worker pool for scanning large nonce ranges
- `internal/store/`: Database layer (SQLite for development, PostgreSQL support)
- `bindings/`: Wails-specific bindings that wrap internal APIs

**Desktop Integration**:
- `main.go`: Wails application entry point with embedded frontend assets
- `backend/bindings/`: Wails bindings that adapt internal APIs for desktop use
- Frontend calls Go methods directly via Wails runtime, no HTTP requests

## Common Commands

### Development Setup
```bash
# Backend standalone development
cd backend
make dev-setup          # Install dev tools (air, goose, golangci-lint)
air                     # Start with hot reload on :8080

# Desktop app development  
wails dev               # Start desktop app with frontend hot reload

# Frontend only
cd frontend
npm install
npm run dev             # Vite dev server on auto-assigned port
```

### Building
```bash
# Desktop app production build
wails build             # Creates distributable desktop app

# Backend standalone build
cd backend
make build              # Creates bin/pf-service executable
```

### Testing
```bash
# Backend tests
cd backend
make test               # Run all tests
make test-race          # Run with race detection
make bench              # Run benchmarks

# No frontend tests currently - UI testing done through desktop app
```

### Code Quality
```bash
# Backend
cd backend
make lint               # golangci-lint
make fmt                # go fmt
make dev                # Full cycle: clean, fmt, lint, test, build

# Frontend
cd frontend  
npm run build           # TypeScript compilation check
```

## Database Operations
```bash
cd backend
make migrate            # Run SQLite migrations
make migrate-create     # Create new migration
rm data.db*             # Reset database (development)
```

## Development Workflow

### Backend Service Development
1. `cd backend && air` - Start standalone service with hot reload
2. Test API endpoints directly: `curl http://localhost:8080/health`
3. Backend can be developed/tested independently of desktop app

### Desktop App Development
1. `wails dev` - Start desktop app with frontend hot reload
2. Backend changes require restart, frontend changes hot reload automatically
3. Go bindings in `backend/bindings/` adapt internal APIs for Wails

### Module Structure
- Root `go.mod` depends on `github.com/wailsapp/wails/v2` and local backend
- Backend `go.mod` is standalone with its own dependencies
- Local replacement: `replace github.com/MJE43/stake-pf-replay-go => ./backend`

## Key Algorithms

### Cryptographic Implementation
- Uses HMAC-SHA256 with server seed as ASCII key (not hex-decoded)
- Message format: `clientSeed:nonce:currentRound`
- Converts 4 bytes to float: `f = b0/256 + b1/256² + b2/256³ + b3/256⁴`
- Games requiring >8 floats increment currentRound for additional entropy
- Fisher-Yates style selection for draw-without-replacement games

### Performance Characteristics
- Worker pool scales with CPU cores (one goroutine per core)
- Allocation-free hot paths for scanning millions of nonces
- Target: millions of evaluations per hour
- Batch processing with configurable limits and timeouts

## Supported Games
- **Limbo**: Crash multiplier game (metric = multiplier)
- **Dice**: Roll 0.00-100.00 (metric = roll value)  
- **Roulette**: European 0-36 (metric = pocket number)
- **Pump**: Position-based multiplier with difficulty levels (metric = multiplier)

Each game implements the `Game` interface and produces a single numeric metric per nonce for efficient scanning.

## Configuration

### Environment Variables
```bash
PORT=8080              # Backend HTTP service port
```

### Wails Configuration (`wails.json`)
- Frontend: Vite + React + TypeScript
- Hot reload in development
- Auto frontend URL detection

## File Patterns

### Adding New Games
1. Implement `Game` interface in `backend/internal/games/`
2. Add to games registry
3. Add tests with golden vectors for reproducibility
4. Update API documentation

### Database Schema
- SQLite for development/desktop app
- Migrations in `backend/migrations/`
- Store runs, hits, and summary statistics
- Support for pagination and filtering

## API Endpoints (Backend Service)

**Core Endpoints:**
- `POST /scan` - Scan nonce range for matches
- `POST /verify` - Verify single nonce with full details
- `GET /games` - List supported games
- `POST /seed/hash` - Hash server seed
- `GET /health` - Health check

**Versioned:** All endpoints available under `/api/v1/` prefix

The desktop app uses direct Go function calls via Wails bindings instead of HTTP requests, but the same logic is shared.