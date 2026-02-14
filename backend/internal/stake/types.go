package stake

import (
	"encoding/json"

	"github.com/shopspring/decimal"
)

// --- Response envelope ---

// Response is the top-level envelope for all Stake API responses.
// Both GraphQL and REST endpoints may return errors in this format.
type Response struct {
	Errors []StakeError    `json:"errors,omitempty"`
	Data   json.RawMessage `json:"data,omitempty"`
}

// HasError returns true if the response contains API errors.
func (r *Response) HasError() bool {
	return len(r.Errors) > 0
}

// FirstError returns the first error, or nil if none.
func (r *Response) FirstError() *StakeError {
	if r.HasError() {
		return &r.Errors[0]
	}
	return nil
}

// --- Balance types ---

// Amount represents a currency amount.
type Amount struct {
	Amount   decimal.Decimal `json:"amount"`
	Currency string          `json:"currency"`
}

// Balance represents available and vault balances for a currency.
type Balance struct {
	Available Amount `json:"available"`
	Vault     Amount `json:"vault"`
}

// User represents a Stake user in API responses.
type User struct {
	ID       string    `json:"id"`
	Balances []Balance `json:"balances"`
}

// UserBalancesData is the response shape for the UserBalances query.
type UserBalancesData struct {
	User User `json:"user"`
}

// --- Seed types ---

// ClientSeed represents the active client seed.
type ClientSeed struct {
	ID   string `json:"id"`
	Seed string `json:"seed"`
}

// ServerSeed represents the active server seed (hashed, not plaintext).
type ServerSeed struct {
	ID           string `json:"id"`
	Nonce        int    `json:"nonce"`
	SeedHash     string `json:"seedHash"`
	NextSeedHash string `json:"nextSeedHash"`
}

// SeedUser contains seed info embedded in the user object.
type SeedUser struct {
	ID               string     `json:"id"`
	ActiveClientSeed ClientSeed `json:"activeClientSeed"`
	ActiveServerSeed ServerSeed `json:"activeServerSeed"`
}

// RotateSeedPairData is the response shape for the RotateSeedPair mutation.
type RotateSeedPairData struct {
	RotateSeedPair struct {
		ClientSeed struct {
			User SeedUser `json:"user"`
		} `json:"clientSeed"`
	} `json:"rotateSeedPair"`
}

// --- Vault types ---

// VaultDepositData is the response shape for the CreateVaultDeposit mutation.
type VaultDepositData struct {
	CreateVaultDeposit struct {
		ID       string          `json:"id"`
		Amount   decimal.Decimal `json:"amount"`
		Currency string          `json:"currency"`
		User     User            `json:"user"`
	} `json:"createVaultDeposit"`
}

// --- Bet types (common) ---

// Card represents a playing card in the API.
type Card struct {
	Rank string `json:"rank"`
	Suit string `json:"suit"`
}

// BetResult is a generic container for a bet response.
// The specific game data is in the raw JSON; callers unmarshal to game-specific types.
type BetResult struct {
	ID               string          `json:"id"`
	Active           bool            `json:"active"`
	Amount           decimal.Decimal `json:"amount"`
	Currency         string          `json:"currency"`
	Payout           decimal.Decimal `json:"payout"`
	PayoutMultiplier float64         `json:"payoutMultiplier"`
	Nonce            int             `json:"nonce"`
	State            json.RawMessage `json:"state,omitempty"`
}

// IsWin returns true if the bet resulted in a win (payoutMultiplier >= 1.0).
func (b *BetResult) IsWin() bool {
	return b.PayoutMultiplier >= 1.0
}

// Profit returns the net profit for this bet (payout - amount).
func (b *BetResult) Profit() decimal.Decimal {
	return b.Payout.Sub(b.Amount)
}

// --- GraphQL request ---

// GraphQLRequest is the standard structure for GraphQL API calls.
type GraphQLRequest struct {
	OperationName string         `json:"operationName"`
	Variables     map[string]any `json:"variables"`
	Query         string         `json:"query"`
}
