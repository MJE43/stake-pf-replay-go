package bindings

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/MJE43/stake-pf-replay-go/internal/stake"
)

// SessionModule manages the Stake API session (token + client).
// Bound to Wails so the frontend can set/test tokens.
type SessionModule struct {
	ctx    context.Context
	mu     sync.RWMutex
	client *stake.Client
	status SessionStatus
}

// SessionStatus is the frontend-facing snapshot of session state.
type SessionStatus struct {
	Connected bool              `json:"connected"`
	Domain    string            `json:"domain"`
	Currency  string            `json:"currency"`
	HasToken  bool              `json:"hasToken"`
	Error     string            `json:"error,omitempty"`
	Balances  []SessionBalance  `json:"balances,omitempty"`
}

// SessionBalance is a simplified balance entry for the frontend.
type SessionBalance struct {
	Currency  string  `json:"currency"`
	Available float64 `json:"available"`
	Vault     float64 `json:"vault"`
}

// NewSessionModule creates a new SessionModule ready to be bound.
func NewSessionModule() *SessionModule {
	return &SessionModule{
		status: SessionStatus{
			Connected: false,
			Domain:    "stake.com",
		},
	}
}

// Startup is called by Wails on application startup.
func (sm *SessionModule) Startup(ctx context.Context) {
	sm.ctx = ctx
}

// SetSessionToken sets the API token and domain, then tests the connection
// by querying balances. Returns the resulting session status.
func (sm *SessionModule) SetSessionToken(token string, domain string, currency string) (SessionStatus, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	token = strings.TrimSpace(token)
	if token == "" {
		sm.status = SessionStatus{Connected: false, Domain: domain, Error: "token is empty"}
		sm.client = nil
		return sm.status, fmt.Errorf("token is empty")
	}

	if domain == "" {
		domain = "stake.com"
	}
	if currency == "" {
		currency = "btc"
	}

	// Create or reconfigure the client
	sm.client = stake.NewClient(stake.Config{
		Domain:       domain,
		SessionToken: token,
		Currency:     currency,
	})

	// Test the connection by fetching balances
	balances, err := sm.client.GetBalances(sm.ctx)
	if err != nil {
		sm.status = SessionStatus{
			Connected: false,
			Domain:    domain,
			Currency:  currency,
			HasToken:  true,
			Error:     err.Error(),
		}
		sm.client = nil
		return sm.status, fmt.Errorf("connection test failed: %w", err)
	}

	// Convert balances to frontend format
	sessionBalances := make([]SessionBalance, 0, len(balances))
	for _, b := range balances {
		avail, _ := b.Available.Amount.Float64()
		vault, _ := b.Vault.Amount.Float64()
		sessionBalances = append(sessionBalances, SessionBalance{
			Currency:  b.Available.Currency,
			Available: avail,
			Vault:     vault,
		})
	}

	sm.status = SessionStatus{
		Connected: true,
		Domain:    domain,
		Currency:  currency,
		HasToken:  true,
		Balances:  sessionBalances,
	}

	return sm.status, nil
}

// Disconnect clears the session token and disconnects.
func (sm *SessionModule) Disconnect() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.client = nil
	sm.status = SessionStatus{
		Connected: false,
		Domain:    sm.status.Domain,
	}
}

// GetSessionStatus returns the current session status.
func (sm *SessionModule) GetSessionStatus() SessionStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.status
}

// SetCurrency updates the default currency for betting.
func (sm *SessionModule) SetCurrency(currency string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.status.Currency = currency
	if sm.client != nil {
		sm.client.SetCurrency(currency)
	}
}

// Client returns the underlying Stake API client (nil if not connected).
// Used internally by other modules (e.g. ApiBetPlacer).
func (sm *SessionModule) Client() *stake.Client {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.client
}

// IsConnected returns whether a valid session exists.
func (sm *SessionModule) IsConnected() bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.client != nil && sm.status.Connected
}
