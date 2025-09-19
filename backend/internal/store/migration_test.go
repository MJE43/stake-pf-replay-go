package store

import (
	"os"
	"testing"
)

func TestMigrationIdempotency(t *testing.T) {
	// Create a temporary database file
	tmpFile := "test_migration_idempotency.db"
	defer os.Remove(tmpFile)

	// Create database connection
	db, err := NewSQLiteDB(tmpFile)
	if err != nil {
		t.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	// Run migrations first time
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate first time: %v", err)
	}

	// Run migrations second time (should not fail)
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate second time: %v", err)
	}

	// Run migrations third time (should still not fail)
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate third time: %v", err)
	}

	// Test that we can still use the database normally
	run := &Run{
		ID:             "migration-test",
		Game:           "limbo",
		ServerSeedHash: "test-hash",
		ClientSeed:     "test-client",
		NonceStart:     1,
		NonceEnd:       1000,
		TargetOp:       ">=",
		TargetVal:      10.0,
		HitCount:       0,
		TotalEvaluated: 1000,
		EngineVersion:  "1.0.0",
	}

	if err := db.SaveRun(run); err != nil {
		t.Fatalf("Failed to save run after multiple migrations: %v", err)
	}

	retrieved, err := db.GetRun("migration-test")
	if err != nil {
		t.Fatalf("Failed to get run after multiple migrations: %v", err)
	}

	if retrieved.ServerSeedHash != run.ServerSeedHash {
		t.Errorf("Data integrity issue after migrations: expected %s, got %s", run.ServerSeedHash, retrieved.ServerSeedHash)
	}

	t.Log("Migration idempotency test passed!")
}