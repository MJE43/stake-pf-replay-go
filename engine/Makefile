.PHONY: build test run clean lint migrate

# Build the service binary
build:
	go build -o bin/pf-service ./cmd/pf-service

# Run tests
test:
	go test -v ./...

# Run tests with race detection
test-race:
	go test -race -v ./...

# Run benchmarks
bench:
	go test -bench=. -benchmem ./...

# Run the service
run:
	go run ./cmd/pf-service

# Run with race detection
run-race:
	go run -race ./cmd/pf-service

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f data.db*

# Lint code
lint:
	golangci-lint run

# Run database migrations
migrate:
	goose -dir migrations sqlite3 ./data.db up

# Create a new migration
migrate-create:
	@read -p "Migration name: " name; \
	goose -dir migrations create $$name sql

# Development setup
dev-setup:
	go mod download
	go install github.com/pressly/goose/v3/cmd/goose@latest

# Format code
fmt:
	go fmt ./...

# Tidy dependencies
tidy:
	go mod tidy

# Full development cycle
dev: clean fmt lint test build

# Docker build
docker-build:
	docker build -t stake-pf-replay .

# Show help
help:
	@echo "Available targets:"
	@echo "  build       - Build the service binary"
	@echo "  test        - Run tests"
	@echo "  test-race   - Run tests with race detection"
	@echo "  bench       - Run benchmarks"
	@echo "  run         - Run the service"
	@echo "  run-race    - Run with race detection"
	@echo "  clean       - Clean build artifacts"
	@echo "  lint        - Lint code"
	@echo "  migrate     - Run database migrations"
	@echo "  dev-setup   - Install development dependencies"
	@echo "  fmt         - Format code"
	@echo "  tidy        - Tidy dependencies"
	@echo "  dev         - Full development cycle"
	@echo "  help        - Show this help"