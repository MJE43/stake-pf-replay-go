package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/games"
	"github.com/MJE43/stake-pf-replay-go/internal/scan"
)

// TestEndToEndScanWorkflow tests the complete scan workflow from HTTP request to response
func TestEndToEndScanWorkflow(t *testing.T) {
	server := NewServer(&mockDB{})

	testCases := []struct {
		name        string
		request     ScanRequest
		expectError bool
		minHits     int
		maxHits     int
	}{
		{
			name: "Limbo high multipliers",
			request: ScanRequest{
				Game:       "limbo",
				Seeds:      games.Seeds{Server: "server_seed_example", Client: "client_seed_example"},
				NonceStart: 1,
				NonceEnd:   10000,
				Params:     map[string]any{"houseEdge": 0.99},
				TargetOp:   "ge",
				TargetVal:  5.0,
				Tolerance:  1e-9,
				Limit:      50,
				TimeoutMs:  10000,
			},
			expectError: false,
			minHits:     1,
			maxHits:     50,
		},
		{
			name: "Dice low rolls",
			request: ScanRequest{
				Game:       "dice",
				Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
				NonceStart: 1,
				NonceEnd:   5000,
				Params:     map[string]any{},
				TargetOp:   "le",
				TargetVal:  2.0,
				Tolerance:  1e-9,
				Limit:      25,
				TimeoutMs:  10000,
			},
			expectError: false,
			minHits:     1,
			maxHits:     25,
		},
		{
			name: "Roulette specific pocket",
			request: ScanRequest{
				Game:       "roulette",
				Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
				NonceStart: 1,
				NonceEnd:   3700, // Should find ~100 hits for any specific pocket
				Params:     map[string]any{},
				TargetOp:   "eq",
				TargetVal:  17.0,
				Tolerance:  0,
				Limit:      200,
				TimeoutMs:  10000,
			},
			expectError: false,
			minHits:     50,
			maxHits:     200,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(tc.request)
			if err != nil {
				t.Fatalf("Failed to marshal request: %v", err)
			}

			req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Routes().ServeHTTP(w, req)

			if tc.expectError {
				if w.Code == http.StatusOK {
					t.Errorf("Expected error but got success")
				}
				return
			}

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
				return
			}

			var response ScanResponse
			if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			// Verify response structure
			if response.EngineVersion == "" {
				t.Error("Expected engine version in response")
			}

			if response.Echo.Game != tc.request.Game {
				t.Errorf("Echo mismatch: expected %s, got %s", tc.request.Game, response.Echo.Game)
			}

			// Verify hit count is within expected range
			hitCount := len(response.Hits)
			if hitCount < tc.minHits {
				t.Errorf("Too few hits: got %d, expected at least %d", hitCount, tc.minHits)
			}
			if hitCount > tc.maxHits {
				t.Errorf("Too many hits: got %d, expected at most %d", hitCount, tc.maxHits)
			}

			// Verify summary statistics
			if response.Summary.TotalEvaluated == 0 {
				t.Error("No evaluations performed")
			}

			if response.Summary.HitsFound != hitCount {
				t.Errorf("Summary hit count mismatch: summary says %d, actual %d", 
					response.Summary.HitsFound, hitCount)
			}

			// Verify all hits meet the target criteria
			verifyHitsCriteria(t, response.Hits, tc.request)

			t.Logf("Test %s completed: %d hits found, %d total evaluated", 
				tc.name, hitCount, response.Summary.TotalEvaluated)
		})
	}
}

// TestTimeoutHandling tests timeout behavior in realistic scenarios
func TestTimeoutHandling(t *testing.T) {
	server := NewServer(&mockDB{})

	// Create a request with a very short timeout and large nonce range
	request := ScanRequest{
		Game:       "limbo",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   1000000, // Large range
		Params:     map[string]any{"houseEdge": 0.99},
		TargetOp:   "ge",
		TargetVal:  10.0, // High multiplier (rare)
		Tolerance:  1e-9,
		Limit:      1000,
		TimeoutMs:  100, // Very short timeout
	}

	body, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	start := time.Now()
	server.Routes().ServeHTTP(w, req)
	duration := time.Since(start)

	// Should complete quickly due to timeout
	if duration > 5*time.Second {
		t.Errorf("Request took too long: %v", duration)
	}

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 even with timeout, got %d", w.Code)
		return
	}

	var response ScanResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should indicate timeout occurred
	if !response.Summary.TimedOut {
		t.Error("Expected timeout flag to be set")
	}

	// Should have partial results
	if response.Summary.TotalEvaluated == 0 {
		t.Error("Expected some evaluations even with timeout")
	}

	t.Logf("Timeout test completed: %d evaluations in %v", 
		response.Summary.TotalEvaluated, duration)
}

// TestLimitHandling tests hit limit behavior
func TestLimitHandling(t *testing.T) {
	server := NewServer(&mockDB{})

	// Create a request that should find many hits but with a low limit
	request := ScanRequest{
		Game:       "dice",
		Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
		NonceStart: 1,
		NonceEnd:   10000,
		Params:     map[string]any{},
		TargetOp:   "ge",
		TargetVal:  50.0, // Should find ~50% of rolls
		Tolerance:  1e-9,
		Limit:      10, // Low limit
		TimeoutMs:  10000,
	}

	body, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("Failed to marshal request: %v", err)
	}

	req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Routes().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		return
	}

	var response ScanResponse
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should respect the limit
	if len(response.Hits) > request.Limit {
		t.Errorf("Too many hits returned: %d > %d", len(response.Hits), request.Limit)
	}

	// Should have found exactly the limit (since there should be many matches)
	if len(response.Hits) != request.Limit {
		t.Errorf("Expected exactly %d hits, got %d", request.Limit, len(response.Hits))
	}

	// Summary should reflect total evaluations, not just hits
	if response.Summary.TotalEvaluated < uint64(request.Limit) {
		t.Errorf("Expected at least %d evaluations, got %d", 
			request.Limit, response.Summary.TotalEvaluated)
	}

	t.Logf("Limit test completed: %d hits (limit %d), %d total evaluated", 
		len(response.Hits), request.Limit, response.Summary.TotalEvaluated)
}

// TestAllGameTypesWithVariousParameters tests all supported games with different parameter combinations
func TestAllGameTypesWithVariousParameters(t *testing.T) {
	server := NewServer(&mockDB{})

	testCases := []struct {
		name    string
		game    string
		params  map[string]any
		targetOp string
		targetVal float64
		targetVal2 float64
	}{
		{
			name:      "Limbo default house edge",
			game:      "limbo",
			params:    map[string]any{},
			targetOp:  "ge",
			targetVal: 2.0,
		},
		{
			name:      "Limbo custom house edge",
			game:      "limbo",
			params:    map[string]any{"houseEdge": 0.95},
			targetOp:  "ge",
			targetVal: 2.0,
		},
		{
			name:      "Dice standard",
			game:      "dice",
			params:    map[string]any{},
			targetOp:  "le",
			targetVal: 10.0,
		},
		{
			name:      "Roulette European",
			game:      "roulette",
			params:    map[string]any{},
			targetOp:  "eq",
			targetVal: 0.0, // Green zero
		},
		{
			name:       "Dice range",
			game:       "dice",
			params:     map[string]any{},
			targetOp:   "between",
			targetVal:  25.0,
			targetVal2: 75.0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			request := ScanRequest{
				Game:       tc.game,
				Seeds:      games.Seeds{Server: "test_server", Client: "test_client"},
				NonceStart: 1,
				NonceEnd:   1000,
				Params:     tc.params,
				TargetOp:   tc.targetOp,
				TargetVal:  tc.targetVal,
				TargetVal2: tc.targetVal2,
				Tolerance:  1e-9,
				Limit:      50,
				TimeoutMs:  10000,
			}

			body, err := json.Marshal(request)
			if err != nil {
				t.Fatalf("Failed to marshal request: %v", err)
			}

			req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Routes().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
				return
			}

			var response ScanResponse
			if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			// Verify basic response structure
			if response.EngineVersion == "" {
				t.Error("Expected engine version in response")
			}

			if response.Summary.TotalEvaluated == 0 {
				t.Error("No evaluations performed")
			}

			// Verify hits meet criteria
			verifyHitsCriteria(t, response.Hits, request)

			t.Logf("Game %s test completed: %d hits found", tc.game, len(response.Hits))
		})
	}
}

// TestErrorHandlingScenarios tests various error conditions
func TestErrorHandlingScenarios(t *testing.T) {
	server := NewServer(&mockDB{})

	testCases := []struct {
		name           string
		request        interface{}
		expectedStatus int
		description    string
	}{
		{
			name:           "Invalid JSON",
			request:        "invalid json",
			expectedStatus: http.StatusBadRequest,
			description:    "Should handle malformed JSON",
		},
		{
			name: "Missing game",
			request: ScanRequest{
				Seeds:      games.Seeds{Server: "test", Client: "test"},
				NonceStart: 1,
				NonceEnd:   10,
				TargetOp:   "ge",
				TargetVal:  1.0,
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Should require game field",
		},
		{
			name: "Invalid game",
			request: ScanRequest{
				Game:       "invalid_game",
				Seeds:      games.Seeds{Server: "test", Client: "test"},
				NonceStart: 1,
				NonceEnd:   10,
				TargetOp:   "ge",
				TargetVal:  1.0,
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Should reject unknown games",
		},
		{
			name: "Invalid nonce range",
			request: ScanRequest{
				Game:       "limbo",
				Seeds:      games.Seeds{Server: "test", Client: "test"},
				NonceStart: 10,
				NonceEnd:   5, // End before start
				TargetOp:   "ge",
				TargetVal:  1.0,
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Should reject invalid nonce ranges",
		},
		{
			name: "Invalid target operation",
			request: ScanRequest{
				Game:       "limbo",
				Seeds:      games.Seeds{Server: "test", Client: "test"},
				NonceStart: 1,
				NonceEnd:   10,
				TargetOp:   "invalid_op",
				TargetVal:  1.0,
			},
			expectedStatus: http.StatusBadRequest,
			description:    "Should reject invalid target operations",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var body []byte
			var err error

			if str, ok := tc.request.(string); ok {
				body = []byte(str)
			} else {
				body, err = json.Marshal(tc.request)
				if err != nil {
					t.Fatalf("Failed to marshal request: %v", err)
				}
			}

			req := httptest.NewRequest("POST", "/scan", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Routes().ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("Expected status %d, got %d. Body: %s", 
					tc.expectedStatus, w.Code, w.Body.String())
			}

			t.Logf("Error test '%s' passed: %s", tc.name, tc.description)
		})
	}
}

// verifyHitsCriteria verifies that all hits meet the specified target criteria
func verifyHitsCriteria(t *testing.T, hits []scan.Hit, request ScanRequest) {
	for i, hit := range hits {
		switch request.TargetOp {
		case "ge":
			if hit.Metric < request.TargetVal-request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is below target %.6f (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.Tolerance)
			}
		case "le":
			if hit.Metric > request.TargetVal+request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is above target %.6f (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.Tolerance)
			}
		case "eq":
			if abs(hit.Metric-request.TargetVal) > request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is not equal to target %.6f (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.Tolerance)
			}
		case "gt":
			if hit.Metric <= request.TargetVal+request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is not greater than target %.6f (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.Tolerance)
			}
		case "lt":
			if hit.Metric >= request.TargetVal-request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is not less than target %.6f (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.Tolerance)
			}
		case "between":
			if hit.Metric < request.TargetVal-request.Tolerance || hit.Metric > request.TargetVal2+request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is outside range [%.6f, %.6f] (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.TargetVal2, request.Tolerance)
			}
		case "outside":
			if hit.Metric >= request.TargetVal-request.Tolerance && hit.Metric <= request.TargetVal2+request.Tolerance {
				t.Errorf("Hit %d has metric %.6f which is inside range [%.6f, %.6f] (tolerance %.9f)", 
					i, hit.Metric, request.TargetVal, request.TargetVal2, request.Tolerance)
			}
		}
	}
}

// abs returns the absolute value of a float64
func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// TestVerifyEndpointIntegration tests the verify endpoint with all games
func TestVerifyEndpointIntegration(t *testing.T) {
	server := NewServer(&mockDB{})

	testCases := []struct {
		name   string
		game   string
		params map[string]any
		nonce  uint64
	}{
		{
			name:   "Limbo verification",
			game:   "limbo",
			params: map[string]any{"houseEdge": 0.99},
			nonce:  1,
		},
		{
			name:   "Dice verification",
			game:   "dice",
			params: map[string]any{},
			nonce:  1,
		},
		{
			name:   "Roulette verification",
			game:   "roulette",
			params: map[string]any{},
			nonce:  1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			request := VerifyRequest{
				Game:  tc.game,
				Seeds: games.Seeds{Server: "test_server", Client: "test_client"},
				Nonce: tc.nonce,
				Params: tc.params,
			}

			body, err := json.Marshal(request)
			if err != nil {
				t.Fatalf("Failed to marshal request: %v", err)
			}

			req := httptest.NewRequest("POST", "/verify", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Routes().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d. Body: %s", w.Code, w.Body.String())
				return
			}

			var response VerifyResponse
			if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
				t.Fatalf("Failed to decode response: %v", err)
			}

			// Verify response structure
			if response.EngineVersion == "" {
				t.Error("Expected engine version in response")
			}

			if response.Nonce != tc.nonce {
				t.Errorf("Expected nonce %d, got %d", tc.nonce, response.Nonce)
			}

			if response.GameResult.Metric == 0 && tc.game != "roulette" {
				t.Error("Expected non-zero metric for most games")
			}

			if response.GameResult.MetricLabel == "" {
				t.Error("Expected metric label in response")
			}

			t.Logf("Verify test for %s completed: metric=%.6f", tc.game, response.GameResult.Metric)
		})
	}
}