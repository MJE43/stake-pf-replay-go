# GEMINI.md - stake-pf-replay-go

## Project Overview

This project is a Go-based backend service designed for replaying and analyzing game outcomes from the Stake.com platform. It provides a high-performance, deterministic game outcome replay tool that can reconstruct what bets would have produced given an unhashed server seed, client seed, and nonce range. This is primarily used to verify the provable fairness of the games.

The service exposes a REST API for scanning nonce ranges, verifying single nonces, and listing available games. It is built with a focus on performance, with features like a high-performance scanning engine and allocation-free hot paths in the cryptographic engine.

**Key Technologies:**

*   **Language:** Go
*   **HTTP Framework:** go-chi/chi
*   **Database:** SQLite (for development)
*   **Build/Automation:** Makefile
*   **Development:** Air for hot-reloading

**Architecture:**

The project follows a standard Go project structure with a clear separation of concerns:

*   `cmd/pf-service/main.go`: The main application entry point.
*   `internal/api`: Handles HTTP routing, middleware, and API handlers.
*   `internal/engine`: Core cryptographic logic for RNG.
*   `internal/games`: Game-specific implementations (Dice, Limbo, etc.).
*   `internal/scan`: High-performance scanning engine.
*   `internal/store`: Database layer.

## Building and Running

The project uses a `Makefile` for all common development tasks.

**Prerequisites:**

*   Go 1.22+
*   Git

**Setup:**

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

**Running the Service:**

*   **Development (with hot-reload):**
    ```bash
    # Install Air for hot-reloading
    go install github.com/cosmtrek/air@latest

    # Start the development server
    air
    ```

*   **Production:**
    ```bash
    # Build and run
    make build
    ./bin/pf-service

    # Or run directly
    make run
    ```

The service will be available at `http://localhost:8080`.

**Testing:**

```bash
# Run all tests
make test

# Run tests with race detection
make test-race

# Run benchmarks
make bench
```

## Development Conventions

*   **Code Style:** The project uses the standard Go formatting (`gofmt`). Use `make fmt` to format the code.
*   **Linting:** `golangci-lint` is used for linting. Run `make lint` to check for code quality issues.
*   **Dependencies:** Go modules are used for dependency management. Use `go mod tidy` to keep the `go.mod` file clean.
*   **Migrations:** Database migrations are handled by `goose`. New migrations can be created with `make migrate-create`.
*   **API:** The API is versioned under `/api/v1`, with legacy routes maintained for backward compatibility.
