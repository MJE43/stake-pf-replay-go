# Stake PF Replay - Go Implementation

A high-performance deterministic game outcome replay tool for Stake Originals games. Reconstructs what your bets would have produced given an unhashed server seed, client seed, and nonce range.

## 🚀 Quick Start

### Prerequisites

- **Go 1.22+** - [Download Go](https://golang.org/dl/)
- **Git** - For cloning the repository

### Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd stake-pf-replay-go/backend

# Install Go dependencies
go mod download

# Install development tools (optional)
make dev-setup

# Run database migrations
make migrate
```

### Running the Service

#### Development (with hot reload)
```bash
# Install Air for hot reloading (optional but recommended)
go install github.com/cosmtrek/air@latest

# Start development server with hot reload
air
```

#### Production Build
```bash
# Build and run
make build
./bin/pf-service.exe

# Or run directly without building
make run
```

The service starts on **http://localhost:8080** by default.

### Verify Installation

Once the service is running, verify it's working:

```bash
# Health check
curl http://localhost:8080/health

# List available games
curl http://localhost:8080/games

# Test scan (should return results in ~6 seconds)
curl -X POST http://localhost:8080/scan \
  -H "Content-Type: application/json" \
  -d '{
    "game": "pump",
    "seeds": {
      "server": "564e967b90f03d0153fdcb2d2d1cc5a5057e0df78163611fe3801d6498e681ca",
      "client": "zXv1upuFns"
    },
    "nonce_start": 1,
    "nonce_end": 1000,
    "target_op": "ge",
    "target_val": 11200,
    "params": {"difficulty": "expert"}
  }'
```

### Configuration

The service can be configured using environment variables:

```bash
# Change the port (default: 8080)
export PORT=3000
air

# Or on Windows
set PORT=3000
air
```

## API Usage

### Scan for Results

```bash
curl -X POST http://localhost:8080/scan \
  -H "Content-Type: application/json" \
  -d '{
    "game": "limbo",
    "seeds": {
      "server": "your_unhashed_server_seed",
      "client": "your_client_seed"
    },
    "nonce_start": 1,
    "nonce_end": 10000,
    "target_op": "ge",
    "target_val": 10.0,
    "limit": 100
  }'
```

### Verify Single Nonce

```bash
curl -X POST http://localhost:8080/verify \
  -H "Content-Type: application/json" \
  -d '{
    "game": "limbo",
    "seeds": {
      "server": "your_unhashed_server_seed",
      "client": "your_client_seed"
    },
    "nonce": 12345
  }'
```

### List Available Games

```bash
curl http://localhost:8080/games
```

### Hash Server Seed

```bash
curl -X POST http://localhost:8080/seed/hash \
  -H "Content-Type: application/json" \
  -d '{"server_seed": "your_unhashed_server_seed"}'
```

### Health Check

```bash
curl http://localhost:8080/health
```

## Supported Games

- **Limbo**: Crash multiplier game
- **Dice**: Roll from 00.00 to 100.00
- **Roulette**: European roulette (0-36)
- **Pump**: Position-based multiplier game with difficulty levels

More games coming in future releases.

## 🛠️ Development

### Development Tools

The project includes several tools to enhance the development experience:

- **Air** - Hot reload for Go applications
- **golangci-lint** - Code linting
- **goose** - Database migrations

### Install Development Dependencies

```bash
# Install all development tools
make dev-setup

# Or install individually:
go install github.com/cosmtrek/air@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

### Development Workflow

1. **Start the development server:**
   ```bash
   air  # Hot reload - automatically rebuilds on file changes
   ```

2. **Make your changes** - Air will automatically rebuild and restart the service

3. **Test your changes:**
   ```bash
   make test        # Run all tests
   make test-race   # Run with race detection
   make lint        # Check code quality
   ```

4. **Build for production:**
   ```bash
   make build       # Creates bin/pf-service.exe
   ```

### API Endpoints

The service provides both legacy endpoints and versioned API endpoints:

- Legacy: `/scan`, `/verify`, `/games`, `/seed/hash`
- Versioned: `/api/v1/scan`, `/api/v1/verify`, `/api/v1/games`, `/api/v1/seed/hash`
- Health: `/health`, `/health/ready`, `/health/live`, `/metrics`

### Common Commands

```bash
# Development
air                # Start development server with hot reload
make run           # Run without building
make run-race      # Run with race detection

# Building
make build         # Build production binary
make clean         # Clean build artifacts

# Testing
make test          # Run all tests
make test-race     # Run tests with race detection
make bench         # Run benchmarks

# Code Quality
make lint          # Lint code with golangci-lint
make fmt           # Format code

# Database
make migrate       # Run database migrations
make migrate-create # Create new migration

# Full Development Cycle
make dev           # Clean, format, lint, test, and build
```

## 🔧 Troubleshooting

### Port Already in Use
If you see "bind: Only one usage of each socket address is normally permitted":
```bash
# Check what's using port 8080
netstat -ano | findstr :8080

# Kill the process or use a different port
set PORT=8081
air
```

### Air Not Found
```bash
# Install Air
go install github.com/cosmtrek/air@latest

# Make sure Go bin is in your PATH
echo $GOPATH/bin  # Should be in your PATH
```

### Build Errors
```bash
# Check build errors
cat tmp/build-errors.log

# Clean and rebuild
make clean
make build
```

### Database Issues
```bash
# Reset database
rm data.db*
make migrate
```

### Project Structure

```
backend/
├── .air.toml                   # Air hot-reload configuration
├── API.md                      # Detailed API documentation
├── Makefile                    # Build automation
├── README.md                   # This file
├── go.mod & go.sum            # Go dependencies
├── data.db*                   # SQLite database files
├── bin/
│   └── pf-service.exe         # Production build
├── cmd/
│   └── pf-service/            # Main service entry point
│       └── main.go
├── internal/                  # Private Go packages
│   ├── api/                   # HTTP handlers & routing
│   │   ├── handlers.go        # API endpoints
│   │   ├── middleware.go      # Request logging & security
│   │   ├── server.go          # HTTP server setup
│   │   └── ...
│   ├── engine/                # Core RNG & cryptographic functions
│   │   ├── rng.go            # HMAC-SHA256 implementation
│   │   └── ...
│   ├── games/                 # Game-specific implementations
│   │   ├── limbo.go          # Limbo crash game
│   │   ├── dice.go           # Dice roll game
│   │   ├── pump.go           # Pump multiplier game
│   │   └── ...
│   ├── scan/                  # High-performance scanning engine
│   │   ├── scanner.go        # Worker pool & batch processing
│   │   └── ...
│   └── store/                 # Database layer
│       ├── sqlite.go         # SQLite implementation
│       └── ...
├── migrations/                # Database schema migrations
│   └── 20241218_001_initial_schema.sql
└── tmp/                       # Air build artifacts (auto-generated)
    ├── pf-service.exe         # Development build
    └── build-errors.log       # Build error logs
```

## Performance

- Linear scaling with CPU cores
- Allocation-free hot paths
- Target: millions of evaluations per hour
- SQLite for development, PostgreSQL for production

## Cryptographic Implementation

- Uses HMAC-SHA256 as specified by Stake
- Server seed treated as ASCII (not hex-decoded)
- 4 bytes per float for deterministic precision
- Bit-for-bit reproducible results

## License

MIT License - see LICENSE file for details.