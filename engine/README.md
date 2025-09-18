# Stake PF Replay - Go Implementation

A high-performance deterministic game outcome replay tool for Stake Originals games. Reconstructs what your bets would have produced given an unhashed server seed, client seed, and nonce range.

## Quick Start

```bash
# Build and run
make build
./bin/pf-service

# Or run directly
make run
```

The service starts on port 8080 by default.

## API Usage

### Scan for Results

```bash
curl -X POST http://localhost:8080/scan \
  -H "Content-Type: application/json" \
  -d '{
    "game": "limbo",
    "server_seed": "your_unhashed_server_seed",
    "client_seed": "your_client_seed",
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
    "server_seed": "your_unhashed_server_seed",
    "client_seed": "your_client_seed",
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

## Supported Games

- **Limbo**: Crash multiplier game
- **Dice**: Roll from 00.00 to 100.00
- **Roulette**: European roulette (0-36)

More games coming in future releases.

## Development

### Prerequisites

- Go 1.22+
- golangci-lint (for linting)
- goose (for migrations)

### Setup

```bash
make dev-setup
make migrate
```

### Common Commands

```bash
make test          # Run tests
make test-race     # Run tests with race detection
make lint          # Lint code
make bench         # Run benchmarks
make dev           # Full development cycle
```

### Project Structure

```
├── cmd/pf-service/     # Main application
├── internal/
│   ├── engine/         # Core RNG and crypto
│   ├── games/          # Game implementations
│   ├── scan/           # High-performance scanning
│   ├── api/            # HTTP handlers
│   └── store/          # Database layer
├── migrations/         # Database migrations
├── testdata/          # Golden test vectors
└── Makefile           # Build automation
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