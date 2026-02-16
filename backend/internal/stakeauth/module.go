package stakeauth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/MJE43/stake-pf-replay-go/internal/stake"
	"github.com/zalando/go-keyring"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// SecretsMasked returns only availability flags to avoid exposing secrets in UI/API.
type SecretsMasked struct {
	HasAPIKey    bool `json:"hasApiKey"`
	HasClearance bool `json:"hasClearance"`
	HasUserAgent bool `json:"hasUserAgent"`
}

// ConnectionStep reports a single step in connection checks.
type ConnectionStep struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// ConnectionCheckResult contains outcomes for all connection check steps.
type ConnectionCheckResult struct {
	OK    bool             `json:"ok"`
	Steps []ConnectionStep `json:"steps"`
}

// SessionBalance is a simplified balance entry for frontend rendering.
type SessionBalance struct {
	Currency  string  `json:"currency"`
	Available float64 `json:"available"`
	Vault     float64 `json:"vault"`
}

// ActiveStatus is the frontend-facing connected session state.
type ActiveStatus struct {
	Connected bool             `json:"connected"`
	AccountID string           `json:"accountId,omitempty"`
	Account   *Account         `json:"account,omitempty"`
	Error     string           `json:"error,omitempty"`
	Balances  []SessionBalance `json:"balances,omitempty"`
}

// Module provides Wails-bound auth/account/session functionality.
type Module struct {
	ctx     context.Context
	store   *Store
	keyring *KeyringStore

	mu          sync.RWMutex
	activeID    string
	active      *stake.Client
	activeState ActiveStatus
}

// NewModule creates a stake auth module.
func NewModule(store *Store, keyringStore *KeyringStore) *Module {
	return &Module{
		store:   store,
		keyring: keyringStore,
		activeState: ActiveStatus{
			Connected: false,
		},
	}
}

// Startup captures wails context.
func (m *Module) Startup(ctx context.Context) {
	m.ctx = ctx
}

func (m *Module) context() context.Context {
	if m.ctx != nil {
		return m.ctx
	}
	return context.Background()
}

func (m *Module) ListAccounts() ([]Account, error) {
	return m.store.List()
}

func (m *Module) SaveAccount(acct Account) (Account, error) {
	return m.store.Save(acct)
}

func (m *Module) DeleteAccount(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("account id is required")
	}
	if err := m.keyring.DeleteAll(id); err != nil && !strings.Contains(strings.ToLower(err.Error()), "not found") {
		return err
	}
	if err := m.store.Delete(id); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.activeID == id {
		m.active = nil
		m.activeID = ""
		m.activeState = ActiveStatus{Connected: false}
	}
	return nil
}

func (m *Module) SetSecrets(id, apiKey, clearance, userAgent string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("account id is required")
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return fmt.Errorf("api key is required")
	}

	if err := m.keyring.SetAPIKey(id, apiKey); err != nil {
		return err
	}
	if err := m.keyring.SetClearance(id, strings.TrimSpace(clearance)); err != nil {
		return err
	}
	if err := m.keyring.SetUserAgent(id, strings.TrimSpace(userAgent)); err != nil {
		return err
	}
	return nil
}

func (m *Module) GetSecretsMasked(id string) (SecretsMasked, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return SecretsMasked{}, fmt.Errorf("account id is required")
	}
	var out SecretsMasked

	if _, err := m.keyring.GetAPIKey(id); err == nil {
		out.HasAPIKey = true
	} else if !strings.Contains(strings.ToLower(err.Error()), "not found") && !isKeyringNotFound(err) {
		return out, err
	}
	if v, err := m.keyring.GetClearance(id); err == nil && strings.TrimSpace(v) != "" {
		out.HasClearance = true
	}
	if v, err := m.keyring.GetUserAgent(id); err == nil && strings.TrimSpace(v) != "" {
		out.HasUserAgent = true
	}
	return out, nil
}

func isKeyringNotFound(err error) bool {
	return err != nil && (errors.Is(err, keyring.ErrNotFound) || strings.Contains(strings.ToLower(err.Error()), "not found"))
}

func (m *Module) ConnectionCheck(id string) (ConnectionCheckResult, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return ConnectionCheckResult{}, fmt.Errorf("account id is required")
	}
	acct, err := m.store.Get(id)
	if err != nil {
		return ConnectionCheckResult{}, err
	}

	apiKey, err := m.keyring.GetAPIKey(id)
	if err != nil {
		return ConnectionCheckResult{}, fmt.Errorf("missing api key: %w", err)
	}
	clearance, _ := m.keyring.GetClearance(id)
	userAgent, _ := m.keyring.GetUserAgent(id)

	result := ConnectionCheckResult{
		OK:    false,
		Steps: []ConnectionStep{},
	}

	httpClient := &http.Client{Timeout: 8 * time.Second}
	base := strings.TrimSpace(acct.Mirror)
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		base = "https://" + base
	}

	// 1) Mirror reachability
	step1 := ConnectionStep{Name: "mirror"}
	req1, _ := http.NewRequestWithContext(m.context(), http.MethodHead, base+"/", nil)
	resp1, err := httpClient.Do(req1)
	if err != nil || resp1 == nil || resp1.StatusCode >= 400 {
		step1.Success = false
		if err != nil {
			step1.Message = err.Error()
		} else {
			step1.Message = fmt.Sprintf("status %d", resp1.StatusCode)
		}
		result.Steps = append(result.Steps, step1)
		return result, nil
	}
	step1.Success = true
	result.Steps = append(result.Steps, step1)

	// 2) Cloudflare/session check
	step2 := ConnectionStep{Name: "cloudflare"}
	req2, _ := http.NewRequestWithContext(
		m.context(),
		http.MethodPost,
		base+"/_api/graphql",
		strings.NewReader(`{"query":"{__typename}"}`),
	)
	req2.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(clearance) != "" {
		req2.Header.Set("Cookie", "cf_clearance="+strings.TrimSpace(clearance))
	}
	if strings.TrimSpace(userAgent) != "" {
		req2.Header.Set("User-Agent", strings.TrimSpace(userAgent))
	}
	resp2, err := httpClient.Do(req2)
	if err != nil || resp2 == nil || resp2.StatusCode >= 500 {
		step2.Success = false
		if err != nil {
			step2.Message = err.Error()
		} else {
			step2.Message = fmt.Sprintf("status %d", resp2.StatusCode)
		}
		result.Steps = append(result.Steps, step2)
		return result, nil
	}
	step2.Success = true
	result.Steps = append(result.Steps, step2)

	// 3) Credentials check via balances query
	step3 := ConnectionStep{Name: "credentials"}
	client := stake.NewClient(stake.Config{
		Domain:       acct.Mirror,
		SessionToken: apiKey,
		Currency:     acct.Currency,
		UserAgent:    strings.TrimSpace(userAgent),
		Clearance:    strings.TrimSpace(clearance),
		HTTPClient:   httpClient,
	})
	if _, err := client.GetBalances(m.context()); err != nil {
		step3.Success = false
		step3.Message = err.Error()
		result.Steps = append(result.Steps, step3)
		return result, nil
	}
	step3.Success = true
	result.Steps = append(result.Steps, step3)
	result.OK = true
	return result, nil
}

func (m *Module) Connect(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("account id is required")
	}
	acct, err := m.store.Get(id)
	if err != nil {
		return err
	}
	apiKey, err := m.keyring.GetAPIKey(id)
	if err != nil {
		return fmt.Errorf("missing api key: %w", err)
	}
	clearance, _ := m.keyring.GetClearance(id)
	userAgent, _ := m.keyring.GetUserAgent(id)

	client := stake.NewClient(stake.Config{
		Domain:       acct.Mirror,
		SessionToken: apiKey,
		Currency:     acct.Currency,
		UserAgent:    strings.TrimSpace(userAgent),
		Clearance:    strings.TrimSpace(clearance),
	})
	balances, err := client.GetBalances(m.context())
	if err != nil {
		m.mu.Lock()
		m.active = nil
		m.activeID = ""
		m.activeState = ActiveStatus{
			Connected: false,
			Error:     err.Error(),
		}
		m.mu.Unlock()
		return err
	}

	viewBalances := make([]SessionBalance, 0, len(balances))
	for _, b := range balances {
		avail, _ := b.Available.Amount.Float64()
		vault, _ := b.Vault.Amount.Float64()
		viewBalances = append(viewBalances, SessionBalance{
			Currency:  b.Available.Currency,
			Available: avail,
			Vault:     vault,
		})
	}

	m.mu.Lock()
	m.active = client
	m.activeID = id
	m.activeState = ActiveStatus{
		Connected: true,
		AccountID: id,
		Account:   acct,
		Balances:  viewBalances,
	}
	m.mu.Unlock()

	return nil
}

func (m *Module) Disconnect() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.active = nil
	m.activeID = ""
	m.activeState = ActiveStatus{Connected: false}
}

func (m *Module) GetActiveStatus() ActiveStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.activeState
}

// Client returns active stake client for internal consumers (e.g. scripting).
func (m *Module) Client() *stake.Client {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.active
}

func (m *Module) IsConnected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.active != nil && m.activeState.Connected
}

func (m *Module) OpenCasinoInBrowser(id string) error {
	acct, err := m.store.Get(strings.TrimSpace(id))
	if err != nil {
		return err
	}
	if m.ctx == nil {
		return fmt.Errorf("wails context not initialized")
	}
	url := strings.TrimSpace(acct.Mirror)
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "https://" + url
	}
	wruntime.BrowserOpenURL(m.ctx, url)
	return nil
}
