package store

// PostgresDB is a stub implementation of the DB interface for PostgreSQL.
//
// To enable Postgres support:
// 1. Add "github.com/lib/pq" (or pgx) to go.mod
// 2. Implement each method below using the provided DSN
// 3. Adjust SQL syntax for Postgres (e.g., $1 placeholders instead of ?)
//
// The store.DB interface is already defined in db.go, so PostgresDB
// only needs to satisfy it.
//
// Build tag: uncomment the build constraint below and the import
// to compile this file only when the "postgres" tag is active.
//
//   //go:build postgres

import (
	"fmt"
)

// PostgresDB wraps a Postgres connection pool.
type PostgresDB struct {
	dsn string
	// db *sql.DB  // uncomment with "database/sql" + "github.com/lib/pq"
}

// NewPostgresDB creates a new Postgres-backed store.
// Example DSN: "postgres://user:pass@localhost:5432/stake_pf?sslmode=disable"
func NewPostgresDB(dsn string) (*PostgresDB, error) {
	return nil, fmt.Errorf("postgres support is not compiled in; build with -tags postgres")
}

// Compile-time check that PostgresDB would satisfy the DB interface
// once all methods are implemented.
// var _ DB = (*PostgresDB)(nil)
