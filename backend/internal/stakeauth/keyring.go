package stakeauth

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/zalando/go-keyring"
)

const (
	keyAPIKey    = "apikey"
	keyClearance = "clearance"
	keyUserAgent = "useragent"
)

// KeyringStore wraps OS keychain with an optional file fallback.
// Fallback is intended for environments where no system keyring is available.
type KeyringStore struct {
	service      string
	fallbackPath string
	mu           sync.Mutex
}

// NewKeyringStore creates a keyring wrapper.
func NewKeyringStore(serviceName, fallbackPath string) *KeyringStore {
	if strings.TrimSpace(serviceName) == "" {
		serviceName = "wen-desktop"
	}
	return &KeyringStore{
		service:      serviceName,
		fallbackPath: fallbackPath,
	}
}

func (k *KeyringStore) key(accountID, part string) string {
	return fmt.Sprintf("%s/%s", accountID, part)
}

func (k *KeyringStore) SetAPIKey(accountID, value string) error {
	return k.setSecret(accountID, keyAPIKey, value)
}

func (k *KeyringStore) GetAPIKey(accountID string) (string, error) {
	return k.getSecret(accountID, keyAPIKey)
}

func (k *KeyringStore) SetClearance(accountID, value string) error {
	return k.setSecret(accountID, keyClearance, value)
}

func (k *KeyringStore) GetClearance(accountID string) (string, error) {
	return k.getSecret(accountID, keyClearance)
}

func (k *KeyringStore) SetUserAgent(accountID, value string) error {
	return k.setSecret(accountID, keyUserAgent, value)
}

func (k *KeyringStore) GetUserAgent(accountID string) (string, error) {
	return k.getSecret(accountID, keyUserAgent)
}

// DeleteAll removes all known secret keys for the given account.
func (k *KeyringStore) DeleteAll(accountID string) error {
	var errs []error
	for _, part := range []string{keyAPIKey, keyClearance, keyUserAgent} {
		if err := keyring.Delete(k.service, k.key(accountID, part)); err != nil && !errors.Is(err, keyring.ErrNotFound) {
			errs = append(errs, err)
		}
	}

	if len(errs) == 0 {
		return k.deleteFallbackAccount(accountID)
	}
	// Try fallback cleanup even if keyring delete failed.
	_ = k.deleteFallbackAccount(accountID)
	return fmt.Errorf("stakeauth: keyring delete failed: %v", errs[0])
}

func (k *KeyringStore) setSecret(accountID, part, value string) error {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return fmt.Errorf("stakeauth: account id is required")
	}

	if err := keyring.Set(k.service, k.key(accountID, part), value); err == nil {
		return nil
	} else if !isKeyringUnavailable(err) {
		return fmt.Errorf("stakeauth: keyring set %s: %w", part, err)
	}

	return k.setFallback(accountID, part, value)
}

func (k *KeyringStore) getSecret(accountID, part string) (string, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return "", fmt.Errorf("stakeauth: account id is required")
	}

	val, err := keyring.Get(k.service, k.key(accountID, part))
	if err == nil {
		return val, nil
	}
	if !isKeyringUnavailable(err) && !errors.Is(err, keyring.ErrNotFound) {
		return "", fmt.Errorf("stakeauth: keyring get %s: %w", part, err)
	}

	fallback, ferr := k.getFallback(accountID, part)
	if ferr == nil {
		return fallback, nil
	}

	if errors.Is(err, keyring.ErrNotFound) {
		return "", keyring.ErrNotFound
	}
	return "", ferr
}

func isKeyringUnavailable(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "secret service") ||
		strings.Contains(msg, "dbus") ||
		strings.Contains(msg, "the specified item could not be found in the keychain") ||
		strings.Contains(msg, "no keychain") ||
		strings.Contains(msg, "keyring backend not available")
}

type fallbackSecrets map[string]map[string]string

func (k *KeyringStore) setFallback(accountID, part, value string) error {
	if strings.TrimSpace(k.fallbackPath) == "" {
		return fmt.Errorf("stakeauth: keyring unavailable and no fallback path configured")
	}
	k.mu.Lock()
	defer k.mu.Unlock()

	data, err := k.readFallbackUnlocked()
	if err != nil {
		return err
	}
	if _, ok := data[accountID]; !ok {
		data[accountID] = map[string]string{}
	}
	data[accountID][part] = value
	return k.writeFallbackUnlocked(data)
}

func (k *KeyringStore) getFallback(accountID, part string) (string, error) {
	if strings.TrimSpace(k.fallbackPath) == "" {
		return "", fmt.Errorf("stakeauth: fallback path not configured")
	}
	k.mu.Lock()
	defer k.mu.Unlock()

	data, err := k.readFallbackUnlocked()
	if err != nil {
		return "", err
	}
	parts, ok := data[accountID]
	if !ok {
		return "", keyring.ErrNotFound
	}
	val, ok := parts[part]
	if !ok {
		return "", keyring.ErrNotFound
	}
	return val, nil
}

func (k *KeyringStore) deleteFallbackAccount(accountID string) error {
	if strings.TrimSpace(k.fallbackPath) == "" {
		return nil
	}
	k.mu.Lock()
	defer k.mu.Unlock()

	data, err := k.readFallbackUnlocked()
	if err != nil {
		return err
	}
	delete(data, accountID)
	return k.writeFallbackUnlocked(data)
}

func (k *KeyringStore) readFallbackUnlocked() (fallbackSecrets, error) {
	out := fallbackSecrets{}
	raw, err := os.ReadFile(k.fallbackPath)
	if err != nil {
		if os.IsNotExist(err) {
			return out, nil
		}
		return nil, fmt.Errorf("stakeauth: read fallback secrets: %w", err)
	}
	if len(raw) == 0 {
		return out, nil
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("stakeauth: decode fallback secrets: %w", err)
	}
	return out, nil
}

func (k *KeyringStore) writeFallbackUnlocked(data fallbackSecrets) error {
	dir := filepath.Dir(k.fallbackPath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("stakeauth: mkdir fallback dir: %w", err)
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("stakeauth: encode fallback secrets: %w", err)
	}
	if err := os.WriteFile(k.fallbackPath, raw, 0o600); err != nil {
		return fmt.Errorf("stakeauth: write fallback secrets: %w", err)
	}
	return nil
}
