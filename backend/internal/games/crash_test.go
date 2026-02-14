package games

import (
	"testing"
)

func TestCrashGameSpec(t *testing.T) {
	g := &CrashGame{}
	spec := g.Spec()
	if spec.ID != "crash" {
		t.Errorf("expected ID 'crash', got %q", spec.ID)
	}
	if spec.MetricLabel != "crash_point" {
		t.Errorf("expected metric_label 'crash_point', got %q", spec.MetricLabel)
	}
}

func TestSlideGameSpec(t *testing.T) {
	g := &SlideGame{}
	spec := g.Spec()
	if spec.ID != "slide" {
		t.Errorf("expected ID 'slide', got %q", spec.ID)
	}
}

func TestCrashSaltChainMode(t *testing.T) {
	g := &CrashGame{}
	params := map[string]any{
		"game_hash": "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5",
		"salt":      "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c",
	}
	result, err := g.Evaluate(Seeds{}, 0, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Metric < 1.0 {
		t.Errorf("crash point should be >= 1.0, got %f", result.Metric)
	}

	details := result.Details.(map[string]any)
	if details["mode"] != "salt_chain" {
		t.Errorf("expected salt_chain mode, got %v", details["mode"])
	}
}

func TestCrashSaltChainMissingSalt(t *testing.T) {
	g := &CrashGame{}
	params := map[string]any{
		"game_hash": "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5",
	}
	_, err := g.Evaluate(Seeds{}, 0, params)
	if err == nil {
		t.Error("expected error for missing salt")
	}
}

func TestCrashFloatFallback(t *testing.T) {
	g := &CrashGame{}
	seeds := Seeds{Server: "test_server", Client: "test_client"}
	result, err := g.Evaluate(seeds, 42, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Metric < 1.0 {
		t.Errorf("crash point should be >= 1.0, got %f", result.Metric)
	}

	details := result.Details.(map[string]any)
	if details["mode"] != "float_fallback" {
		t.Errorf("expected float_fallback mode, got %v", details["mode"])
	}
}

func TestCrashDeterministic(t *testing.T) {
	g := &CrashGame{}
	params := map[string]any{
		"game_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
		"salt":      "test_salt",
	}

	r1, _ := g.Evaluate(Seeds{}, 0, params)
	r2, _ := g.Evaluate(Seeds{}, 0, params)

	if r1.Metric != r2.Metric {
		t.Errorf("crash should be deterministic: got %f and %f", r1.Metric, r2.Metric)
	}
}

func TestCrashRegistered(t *testing.T) {
	game, ok := GetGame("crash")
	if !ok {
		t.Fatal("crash game should be registered")
	}
	if game.Spec().Name != "Crash" {
		t.Errorf("expected name 'Crash', got %q", game.Spec().Name)
	}
}

func TestSlideRegistered(t *testing.T) {
	game, ok := GetGame("slide")
	if !ok {
		t.Fatal("slide game should be registered")
	}
	if game.Spec().Name != "Slide" {
		t.Errorf("expected name 'Slide', got %q", game.Spec().Name)
	}
}

func TestSlideSaltChainMode(t *testing.T) {
	g := &SlideGame{}
	params := map[string]any{
		"game_hash": "77b271fe12fca03c618f63a71571f35aea4fe4478d1a8b528f9f4a9031adbab5",
		"salt":      "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c",
	}
	result, err := g.Evaluate(Seeds{}, 0, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.MetricLabel != "slide_point" {
		t.Errorf("expected metric_label 'slide_point', got %q", result.MetricLabel)
	}
}
