package store

import (
	"testing"
)

func TestListRuns(t *testing.T) {
	// Create in-memory database for testing
	db, err := NewSQLiteDB(":memory:")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Create test runs
	runs := []*Run{
		{
			ID:             "run1",
			Game:           "limbo",
			ServerSeedHash: "hash1",
			ClientSeed:     "client1",
			NonceStart:     1,
			NonceEnd:       1000,
			TargetOp:       ">=",
			TargetVal:      10.0,
			HitCount:       5,
			TotalEvaluated: 1000,
			EngineVersion:  "1.0.0",
		},
		{
			ID:             "run2",
			Game:           "dice",
			ServerSeedHash: "hash2",
			ClientSeed:     "client2",
			NonceStart:     1,
			NonceEnd:       500,
			TargetOp:       "<=",
			TargetVal:      50.0,
			HitCount:       10,
			TotalEvaluated: 500,
			EngineVersion:  "1.0.0",
		},
		{
			ID:             "run3",
			Game:           "limbo",
			ServerSeedHash: "hash3",
			ClientSeed:     "client3",
			NonceStart:     1,
			NonceEnd:       2000,
			TargetOp:       ">=",
			TargetVal:      5.0,
			HitCount:       20,
			TotalEvaluated: 2000,
			EngineVersion:  "1.0.0",
		},
	}

	// Save test runs
	for _, run := range runs {
		if err := db.SaveRun(run); err != nil {
			t.Fatalf("Failed to save run %s: %v", run.ID, err)
		}
	}

	// Test listing all runs
	result, err := db.ListRuns(RunsQuery{Page: 1, PerPage: 10})
	if err != nil {
		t.Fatalf("Failed to list runs: %v", err)
	}

	if result.TotalCount != 3 {
		t.Errorf("Expected 3 total runs, got %d", result.TotalCount)
	}

	if len(result.Runs) != 3 {
		t.Errorf("Expected 3 runs in result, got %d", len(result.Runs))
	}

	// Test filtering by game
	result, err = db.ListRuns(RunsQuery{Game: "limbo", Page: 1, PerPage: 10})
	if err != nil {
		t.Fatalf("Failed to list limbo runs: %v", err)
	}

	if result.TotalCount != 2 {
		t.Errorf("Expected 2 limbo runs, got %d", result.TotalCount)
	}

	if len(result.Runs) != 2 {
		t.Errorf("Expected 2 limbo runs in result, got %d", len(result.Runs))
	}

	// Test pagination
	result, err = db.ListRuns(RunsQuery{Page: 1, PerPage: 2})
	if err != nil {
		t.Fatalf("Failed to list runs with pagination: %v", err)
	}

	if len(result.Runs) != 2 {
		t.Errorf("Expected 2 runs per page, got %d", len(result.Runs))
	}

	if result.TotalPages != 2 {
		t.Errorf("Expected 2 total pages, got %d", result.TotalPages)
	}
}

func TestListRunsBySeed(t *testing.T) {
	db, err := NewSQLiteDB(":memory:")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	serverA := "super-secret-server"
	serverAHash := computeServerHash(serverA)
	clientA := "client-a"

	runs := []*Run{
		{
			ID:             "seed-a-limbo",
			Game:           "limbo",
			ServerSeed:     serverA,
			ServerSeedHash: serverAHash,
			ClientSeed:     clientA,
			NonceStart:     1,
			NonceEnd:       100,
			TargetOp:       "ge",
			TargetVal:      1.2,
			EngineVersion:  "1.0.0",
		},
		{
			ID:             "seed-a-dice",
			Game:           "dice",
			ServerSeed:     serverA,
			ServerSeedHash: serverAHash,
			ClientSeed:     clientA,
			NonceStart:     5,
			NonceEnd:       200,
			TargetOp:       "ge",
			TargetVal:      50,
			EngineVersion:  "1.0.0",
		},
		{
			ID:         "seed-a-legacy",
			Game:       "roulette",
			ServerSeed: serverA,
			// no hash stored to mimic legacy rows
			ClientSeed:    clientA,
			NonceStart:    10,
			NonceEnd:      20,
			TargetOp:      "ge",
			TargetVal:     2,
			EngineVersion: "1.0.0",
		},
		{
			ID:             "other-client",
			Game:           "limbo",
			ServerSeed:     serverA,
			ServerSeedHash: serverAHash,
			ClientSeed:     "client-b",
			NonceStart:     1,
			NonceEnd:       50,
			TargetOp:       "ge",
			TargetVal:      1.1,
			EngineVersion:  "1.0.0",
		},
		{
			ID:             "other-server",
			Game:           "limbo",
			ServerSeed:     "different-server",
			ServerSeedHash: computeServerHash("different-server"),
			ClientSeed:     clientA,
			NonceStart:     1,
			NonceEnd:       10,
			TargetOp:       "ge",
			TargetVal:      1.0,
			EngineVersion:  "1.0.0",
		},
	}

	for _, run := range runs {
		if err := db.SaveRun(run); err != nil {
			t.Fatalf("Failed to save run %s: %v", run.ID, err)
		}
	}

	results, err := db.ListRunsBySeed(serverAHash, serverA, clientA)
	if err != nil {
		t.Fatalf("ListRunsBySeed failed: %v", err)
	}

	if len(results) != 3 {
		t.Fatalf("Expected 3 runs sharing seed, got %d", len(results))
	}

	for _, run := range results {
		if run.ClientSeed != clientA {
			t.Errorf("unexpected client seed %s in results", run.ClientSeed)
		}
		if run.ServerSeed != serverA {
			t.Errorf("unexpected server seed %s in results", run.ServerSeed)
		}
	}
}

func TestGetRunHits(t *testing.T) {
	// Create in-memory database for testing
	db, err := NewSQLiteDB(":memory:")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Create test run
	run := &Run{
		ID:             "test-run",
		Game:           "limbo",
		ServerSeedHash: "test-hash",
		ClientSeed:     "test-client",
		NonceStart:     1,
		NonceEnd:       1000,
		TargetOp:       ">=",
		TargetVal:      10.0,
		HitCount:       5,
		TotalEvaluated: 1000,
		EngineVersion:  "1.0.0",
	}

	if err := db.SaveRun(run); err != nil {
		t.Fatalf("Failed to save run: %v", err)
	}

	// Create test hits
	hits := []Hit{
		{RunID: "test-run", Nonce: 100, Metric: 15.5, Details: `{"multiplier": 15.5}`},
		{RunID: "test-run", Nonce: 250, Metric: 12.3, Details: `{"multiplier": 12.3}`},
		{RunID: "test-run", Nonce: 500, Metric: 20.1, Details: `{"multiplier": 20.1}`},
		{RunID: "test-run", Nonce: 750, Metric: 11.7, Details: `{"multiplier": 11.7}`},
		{RunID: "test-run", Nonce: 900, Metric: 18.9, Details: `{"multiplier": 18.9}`},
	}

	if err := db.SaveHits("test-run", hits); err != nil {
		t.Fatalf("Failed to save hits: %v", err)
	}

	// Test getting hits with pagination
	result, err := db.GetRunHits("test-run", 1, 3)
	if err != nil {
		t.Fatalf("Failed to get run hits: %v", err)
	}

	if result.TotalCount != 5 {
		t.Errorf("Expected 5 total hits, got %d", result.TotalCount)
	}

	if len(result.Hits) != 3 {
		t.Errorf("Expected 3 hits in first page, got %d", len(result.Hits))
	}

	if result.TotalPages != 2 {
		t.Errorf("Expected 2 total pages, got %d", result.TotalPages)
	}

	// Test delta nonce calculation
	if result.Hits[0].DeltaNonce != nil {
		t.Errorf("First hit should have nil delta nonce, got %v", *result.Hits[0].DeltaNonce)
	}

	if result.Hits[1].DeltaNonce == nil {
		t.Error("Second hit should have delta nonce")
	} else if *result.Hits[1].DeltaNonce != 150 {
		t.Errorf("Expected delta nonce 150, got %d", *result.Hits[1].DeltaNonce)
	}

	if result.Hits[2].DeltaNonce == nil {
		t.Error("Third hit should have delta nonce")
	} else if *result.Hits[2].DeltaNonce != 250 {
		t.Errorf("Expected delta nonce 250, got %d", *result.Hits[2].DeltaNonce)
	}

	// Test second page
	result, err = db.GetRunHits("test-run", 2, 3)
	if err != nil {
		t.Fatalf("Failed to get run hits page 2: %v", err)
	}

	if len(result.Hits) != 2 {
		t.Errorf("Expected 2 hits in second page, got %d", len(result.Hits))
	}

	// First hit on second page should have delta from last hit on first page
	if result.Hits[0].DeltaNonce == nil {
		t.Error("First hit on second page should have delta nonce")
	} else if *result.Hits[0].DeltaNonce != 250 {
		t.Errorf("Expected delta nonce 250 for first hit on page 2, got %d", *result.Hits[0].DeltaNonce)
	}
}

func TestServerSeedHashStorage(t *testing.T) {
	// Create in-memory database for testing
	db, err := NewSQLiteDB(":memory:")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Create test run with server seed hash
	run := &Run{
		ID:             "hash-test",
		Game:           "limbo",
		ServerSeed:     "", // Should be empty - we only store hash
		ServerSeedHash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
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
		t.Fatalf("Failed to save run: %v", err)
	}

	// Retrieve and verify
	retrieved, err := db.GetRun("hash-test")
	if err != nil {
		t.Fatalf("Failed to get run: %v", err)
	}

	if retrieved.ServerSeedHash != run.ServerSeedHash {
		t.Errorf("Expected server seed hash %s, got %s", run.ServerSeedHash, retrieved.ServerSeedHash)
	}

	// Verify server seed is empty (we don't store raw seeds)
	if retrieved.ServerSeed != "" {
		t.Errorf("Expected empty server seed, got %s", retrieved.ServerSeed)
	}
}
