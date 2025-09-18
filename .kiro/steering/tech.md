# Technology Stack & Build System

## Architecture

**2-Tier System:**
- **Frontend + BFF**: Next.js 14 (TypeScript, App Router) for UI and backend-for-frontend
- **Compute Engine**: Go service for high-performance HMAC calculations and game logic

## Go Service (Compute Engine)

### Core Stack
- **Language**: Go 1.22+
- **HTTP Framework**: chi router with net/http
- **Database**: SQLite (dev) / PostgreSQL (prod) via pgx
- **Migrations**: goose
- **Concurrency**: Goroutines with bounded worker pools

### Key Dependencies
```go
github.com/go-chi/chi/v5        // HTTP routing
github.com/pressly/goose/v3     // Database migrations
modernc.org/sqlite              // SQLite driver
github.com/google/uuid          // UUID generation
```

## Frontend (Next.js)

### Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **UI**: React 18, Tailwind CSS, shadcn/ui
- **Data**: TanStack Query, Zod validation
- **Charts**: Recharts for distributions/histograms

## Common Commands

### Go Service
```bash
# Build the service
go build -o bin/pf-service ./cmd/pf-service

# Run with race detection
go run -race ./cmd/pf-service

# Run tests with golden vectors
go test -v ./...

# Database migrations
goose -dir migrations sqlite3 ./data.db up

# Lint
golangci-lint run
```

### Frontend
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Performance Requirements

- **Throughput**: Linear scaling with CPU cores
- **Memory**: Allocation-free hot paths for scanning
- **Target**: Millions of evaluations per hour on multi-core machines
- **Concurrency**: GOMAXPROCS tuned worker pools

## Cryptographic Standards

- **RNG**: HMAC-SHA256 only (no custom crypto)
- **Server Seed**: Treated as ASCII string (not hex-decoded)
- **Precision**: 4 bytes per float for deterministic results