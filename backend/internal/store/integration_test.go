package store

import (
	"os"
	"testing"
)

func TestIntegrationWithRealDB(t *testing.T) {
	// Create a temporary database file
	tmpFile := "test_integration.db"
	defer os.Remove(tmpFile)

	// Create database connection
	db, err := NewSQLiteDB(tmpFile)
	if err != nil {
		t.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// Test complete workflow
	run := &Run{
		ID:             "integration-test",
		Game:           "limbo",
		ServerSeedHash: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
		ClientSeed:     "integration-client",
		NonceStart:     1,
		NonceEnd:       10000,
		ParamsJSON:     `{"target": 10.0}`,
		TargetOp:       ">=",
		TargetVal:      10.0,
		Tolerance:      0.1,
		HitLimit:       100,
		TimedOut:       false,
		HitCount:       3,
		TotalEvaluated: 10000,
		EngineVersion:  "1.0.0",
	}

	// Set summary statistics
	min := 10.5
	max := 25.7
	sum := 48.9
	run.SummaryMin = &min
	run.SummaryMax = &max
	run.SummarySum = &sum
	run.SummaryCount = 3

	// Save run
	if err := db.SaveRun(run); err != nil {
		t.Fatalf("Failed to save run: %v", err)
	}

	// Save hits
	hits := []Hit{
		{RunID: "integration-test", Nonce: 1500, Metric: 10.5, Details: `{"multiplier": 10.5}`},
		{RunID: "integration-test", Nonce: 5000, Metric: 12.7, Details: `{"multiplier": 12.7}`},
		{RunID: "integration-test", Nonce: 8500, Metric: 25.7, Details: `{"multiplier": 25.7}`},
	}

	if err := db.SaveHits("integration-test", hits); err != nil {
		t.Fatalf("Failed to save hits: %v", err)
	}

	// Test GetRun
	retrievedRun, err := db.GetRun("integration-test")
	if err != nil {
		t.Fatalf("Failed to get run: %v", err)
	}

	if retrievedRun.ServerSeedHash != run.ServerSeedHash {
		t.Errorf("Server seed hash mismatch: expected %s, got %s", run.ServerSeedHash, retrievedRun.ServerSeedHash)
	}

	if retrievedRun.ParamsJSON != run.ParamsJSON {
		t.Errorf("Params JSON mismatch: expected %s, got %s", run.ParamsJSON, retrievedRun.ParamsJSON)
	}

	if retrievedRun.SummaryMin == nil || *retrievedRun.SummaryMin != *run.SummaryMin {
		t.Errorf("Summary min mismatch: expected %v, got %v", run.SummaryMin, retrievedRun.SummaryMin)
	}

	// Test ListRuns
	runsList, err := db.ListRuns(RunsQuery{Page: 1, PerPage: 10})
	if err != nil {
		t.Fatalf("Failed to list runs: %v", err)
	}

	if runsList.TotalCount != 1 {
		t.Errorf("Expected 1 run, got %d", runsList.TotalCount)
	}

	// Test GetRunHits
	hitsPage, err := db.GetRunHits("integration-test", 1, 10)
	if err != nil {
		t.Fatalf("Failed to get run hits: %v", err)
	}

	if hitsPage.TotalCount != 3 {
		t.Errorf("Expected 3 hits, got %d", hitsPage.TotalCount)
	}

	if len(hitsPage.Hits) != 3 {
		t.Errorf("Expected 3 hits in page, got %d", len(hitsPage.Hits))
	}

	// Verify delta nonce calculations
	if hitsPage.Hits[0].DeltaNonce != nil {
		t.Errorf("First hit should have nil delta nonce")
	}

	if hitsPage.Hits[1].DeltaNonce == nil {
		t.Error("Second hit should have delta nonce")
	} else if *hitsPage.Hits[1].DeltaNonce != 3500 {
		t.Errorf("Expected delta nonce 3500, got %d", *hitsPage.Hits[1].DeltaNonce)
	}

	if hitsPage.Hits[2].DeltaNonce == nil {
		t.Error("Third hit should have delta nonce")
	} else if *hitsPage.Hits[2].DeltaNonce != 3500 {
		t.Errorf("Expected delta nonce 3500, got %d", *hitsPage.Hits[2].DeltaNonce)
	}

	t.Log("Integration test passed successfully!")
}