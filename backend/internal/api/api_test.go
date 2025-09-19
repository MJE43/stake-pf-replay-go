package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/store"
)

// mockDB is a simple mock implementation of store.DB for testing
type mockDB struct{}

func (m *mockDB) Close() error                                                    { return nil }
func (m *mockDB) Migrate() error                                                  { return nil }
func (m *mockDB) SaveRun(run *store.Run) error                                    { return nil }
func (m *mockDB) SaveHits(runID string, hits []store.Hit) error                  { return nil }
func (m *mockDB) GetRun(id string) (*store.Run, error)                           { return nil, nil }
func (m *mockDB) GetHits(runID string, limit, offset int) ([]store.Hit, error)   { return nil, nil }

func TestHealthEndpoint(t *testing.T) {
	server := NewServer(&mockDB{})
	
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestGamesEndpoint(t *testing.T) {
	server := NewServer(&mockDB{})
	
	req := httptest.NewRequest("GET", "/games", nil)
	w := httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var response GamesResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	
	if len(response.Games) == 0 {
		t.Error("Expected at least one game in response")
	}
	
	if response.EngineVersion == "" {
		t.Error("Expected engine version in response")
	}
}

func TestSeedHashEndpoint(t *testing.T) {
	server := NewServer(&mockDB{})
	
	reqBody := SeedHashRequest{
		ServerSeed: "test_server_seed",
	}
	
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/seed/hash", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var response SeedHashResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	
	if response.Hash == "" {
		t.Error("Expected hash in response")
	}
	
	if response.EngineVersion == "" {
		t.Error("Expected engine version in response")
	}
	
	if response.Echo.ServerSeed != reqBody.ServerSeed {
		t.Error("Expected echo to match request")
	}
}

func TestVerifyEndpoint(t *testing.T) {
	server := NewServer(&mockDB{})
	
	reqBody := VerifyRequest{
		Game: "limbo",
		Seeds: games.Seeds{
			Server: "test_server",
			Client: "test_client",
		},
		Nonce: 1,
	}
	
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/verify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var response VerifyResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	
	if response.Nonce != reqBody.Nonce {
		t.Error("Expected nonce to match request")
	}
	
	if response.EngineVersion == "" {
		t.Error("Expected engine version in response")
	}
}

func TestScanEndpointValidation(t *testing.T) {
	server := NewServer(&mockDB{})
	
	// Test invalid JSON
	req := httptest.NewRequest("POST", "/scan", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON, got %d", w.Code)
	}
	
	// Test missing required fields
	reqBody := ScanRequest{
		// Missing game field
		Seeds: games.Seeds{
			Server: "test_server",
			Client: "test_client",
		},
		NonceStart: 1,
		NonceEnd:   10,
		TargetOp:   "ge",
		TargetVal:  1.0,
	}
	
	body, _ := json.Marshal(reqBody)
	req = httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	
	server.Routes().ServeHTTP(w, req)
	
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for missing game, got %d", w.Code)
	}
}