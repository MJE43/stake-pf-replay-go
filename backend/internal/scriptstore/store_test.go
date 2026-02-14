package scriptstore

import (
	"os"
	"path/filepath"
	"testing"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test_script.db")
	store, err := New(dbPath)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := store.Migrate(); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	t.Cleanup(func() {
		store.Close()
		os.Remove(dbPath)
	})
	return store
}

func TestCreateAndGetSession(t *testing.T) {
	store := testStore(t)

	sess := &ScriptSession{
		Name:         "Test Session",
		Game:         "dice",
		Currency:     "trx",
		Mode:         "simulated",
		ScriptSource: "nextbet = 0.001",
		StartBalance: 1.0,
	}

	id, err := store.CreateSession(sess)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if id == "" {
		t.Fatal("expected non-empty session ID")
	}

	got, err := store.GetSession(id)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if got.Game != "dice" {
		t.Errorf("Game = %q, want dice", got.Game)
	}
	if got.FinalState != "running" {
		t.Errorf("FinalState = %q, want running", got.FinalState)
	}
}

func TestEndSession(t *testing.T) {
	store := testStore(t)

	sess := &ScriptSession{Game: "limbo", Currency: "btc", Mode: "live", StartBalance: 0.5}
	id, _ := store.CreateSession(sess)

	stats := SessionStats{
		FinalBalance:  0.55,
		TotalBets:     100,
		TotalWins:     55,
		TotalLosses:   45,
		TotalProfit:   0.05,
		TotalWagered:  2.0,
		HighestStreak: 8,
		LowestStreak:  -5,
	}

	if err := store.EndSession(id, "stopped", stats); err != nil {
		t.Fatalf("EndSession: %v", err)
	}

	got, _ := store.GetSession(id)
	if got.FinalState != "stopped" {
		t.Errorf("FinalState = %q, want stopped", got.FinalState)
	}
	if got.TotalBets != 100 {
		t.Errorf("TotalBets = %d, want 100", got.TotalBets)
	}
	if got.EndedAt == nil {
		t.Error("EndedAt should not be nil")
	}
}

func TestInsertAndGetBets(t *testing.T) {
	store := testStore(t)

	sess := &ScriptSession{Game: "dice", Currency: "trx", Mode: "simulated", StartBalance: 1.0}
	id, _ := store.CreateSession(sess)

	bets := make([]ScriptBet, 10)
	for i := range bets {
		roll := float64(i * 10)
		bets[i] = ScriptBet{
			SessionID:   id,
			Nonce:       i + 1,
			Amount:      0.001,
			Payout:      0.002,
			PayoutMulti: 2.0,
			Win:         i%2 == 0,
			Roll:        &roll,
		}
	}

	if err := store.InsertBetsBatch(id, bets); err != nil {
		t.Fatalf("InsertBetsBatch: %v", err)
	}

	page, err := store.GetSessionBets(id, 1, 5)
	if err != nil {
		t.Fatalf("GetSessionBets: %v", err)
	}
	if page.TotalCount != 10 {
		t.Errorf("TotalCount = %d, want 10", page.TotalCount)
	}
	if len(page.Bets) != 5 {
		t.Errorf("Bets returned = %d, want 5", len(page.Bets))
	}
	if page.TotalPages != 2 {
		t.Errorf("TotalPages = %d, want 2", page.TotalPages)
	}
}

func TestListAndDeleteSession(t *testing.T) {
	store := testStore(t)

	// Create 3 sessions
	for i := 0; i < 3; i++ {
		sess := &ScriptSession{Game: "dice", Currency: "trx", Mode: "simulated", StartBalance: 1.0}
		store.CreateSession(sess)
	}

	sessions, total, err := store.ListSessions(10, 0)
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(sessions) != 3 {
		t.Errorf("sessions = %d, want 3", len(sessions))
	}

	// Delete one
	if err := store.DeleteSession(sessions[0].ID); err != nil {
		t.Fatalf("DeleteSession: %v", err)
	}

	_, total, _ = store.ListSessions(10, 0)
	if total != 2 {
		t.Errorf("total after delete = %d, want 2", total)
	}
}
