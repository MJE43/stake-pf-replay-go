package stake

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/shopspring/decimal"
)

// --- Balance operations ---

const userBalancesQuery = `query UserBalances {
  user {
    id
    balances {
      available {
        amount
        currency
        __typename
      }
      vault {
        amount
        currency
        __typename
      }
      __typename
    }
    __typename
  }
}`

// GetBalances queries all currency balances for the authenticated user.
func (c *Client) GetBalances(ctx context.Context) ([]Balance, error) {
	resp, err := c.graphql(ctx, &GraphQLRequest{
		OperationName: "UserBalances",
		Variables:     map[string]any{},
		Query:         userBalancesQuery,
	})
	if err != nil {
		return nil, err
	}
	if resp.HasError() {
		return nil, resp.FirstError()
	}

	var data struct {
		User struct {
			Balances []Balance `json:"balances"`
		} `json:"user"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, fmt.Errorf("stake: parse balances: %w", err)
	}

	return data.User.Balances, nil
}

// GetBalance queries the available balance for a specific currency.
// Returns 0 if the currency is not found.
func (c *Client) GetBalance(ctx context.Context, currency string) (decimal.Decimal, error) {
	balances, err := c.GetBalances(ctx)
	if err != nil {
		return decimal.Zero, err
	}

	for _, b := range balances {
		if b.Available.Currency == currency {
			return b.Available.Amount, nil
		}
	}

	return decimal.Zero, nil
}

// --- Seed rotation ---

const rotateSeedPairMutation = `mutation RotateSeedPair($seed: String!) {
  rotateSeedPair(seed: $seed) {
    clientSeed {
      user {
        id
        activeClientSeed {
          id
          seed
          __typename
        }
        activeServerSeed {
          id
          nonce
          seedHash
          nextSeedHash
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`

// SeedInfo contains the result of a seed rotation.
type SeedInfo struct {
	ClientSeed string
	ServerHash string
	NextHash   string
	Nonce      int
}

// RotateSeed rotates the seed pair, setting a new client seed.
// If clientSeed is empty, a random 10-character seed is generated.
// Returns the new seed information including the server seed hash.
func (c *Client) RotateSeed(ctx context.Context, clientSeed string) (*SeedInfo, error) {
	if clientSeed == "" {
		clientSeed = DefaultClientSeed()
	}

	resp, err := c.graphql(ctx, &GraphQLRequest{
		OperationName: "RotateSeedPair",
		Variables:     map[string]any{"seed": clientSeed},
		Query:         rotateSeedPairMutation,
	})
	if err != nil {
		return nil, err
	}
	if resp.HasError() {
		return nil, resp.FirstError()
	}

	var data RotateSeedPairData
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, fmt.Errorf("stake: parse seed rotation: %w", err)
	}

	user := data.RotateSeedPair.ClientSeed.User
	return &SeedInfo{
		ClientSeed: user.ActiveClientSeed.Seed,
		ServerHash: user.ActiveServerSeed.SeedHash,
		NextHash:   user.ActiveServerSeed.NextSeedHash,
		Nonce:      user.ActiveServerSeed.Nonce,
	}, nil
}

// --- Vault operations ---

const createVaultDepositMutation = `mutation CreateVaultDeposit($currency: CurrencyEnum!, $amount: Float!) {
  createVaultDeposit(currency: $currency, amount: $amount) {
    id
    amount
    currency
    user {
      id
      balances {
        available {
          amount
          currency
          __typename
        }
        vault {
          amount
          currency
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`

// VaultDeposit deposits the specified amount to the vault.
// Returns the updated balances after the deposit.
func (c *Client) VaultDeposit(ctx context.Context, currency string, amount float64) ([]Balance, error) {
	resp, err := c.graphql(ctx, &GraphQLRequest{
		OperationName: "CreateVaultDeposit",
		Variables:     map[string]any{"currency": currency, "amount": amount},
		Query:         createVaultDepositMutation,
	})
	if err != nil {
		return nil, err
	}
	if resp.HasError() {
		return nil, resp.FirstError()
	}

	var data VaultDepositData
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, fmt.Errorf("stake: parse vault deposit: %w", err)
	}

	return data.CreateVaultDeposit.User.Balances, nil
}
