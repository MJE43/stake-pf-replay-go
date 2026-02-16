package stakeauth

import (
	"path/filepath"
	"testing"
)

func TestKeyringStoreSetGetDelete(t *testing.T) {
	k := NewKeyringStore("wen-desktop-test", filepath.Join(t.TempDir(), "fallback_secrets.json"))
	accountID := "acc-test"

	if err := k.SetAPIKey(accountID, "api-key-123"); err != nil {
		t.Fatalf("SetAPIKey: %v", err)
	}
	if err := k.SetClearance(accountID, "cf-token-456"); err != nil {
		t.Fatalf("SetClearance: %v", err)
	}
	if err := k.SetUserAgent(accountID, "UA Test"); err != nil {
		t.Fatalf("SetUserAgent: %v", err)
	}

	apiKey, err := k.GetAPIKey(accountID)
	if err != nil {
		t.Fatalf("GetAPIKey: %v", err)
	}
	if apiKey != "api-key-123" {
		t.Fatalf("unexpected api key: %q", apiKey)
	}

	clearance, err := k.GetClearance(accountID)
	if err != nil {
		t.Fatalf("GetClearance: %v", err)
	}
	if clearance != "cf-token-456" {
		t.Fatalf("unexpected clearance: %q", clearance)
	}

	ua, err := k.GetUserAgent(accountID)
	if err != nil {
		t.Fatalf("GetUserAgent: %v", err)
	}
	if ua != "UA Test" {
		t.Fatalf("unexpected user-agent: %q", ua)
	}

	if err := k.DeleteAll(accountID); err != nil {
		t.Fatalf("DeleteAll: %v", err)
	}
}
