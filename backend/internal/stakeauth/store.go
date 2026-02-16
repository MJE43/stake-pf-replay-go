package stakeauth

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Account stores non-secret account metadata.
// Secrets (api key, cf_clearance, user-agent) are stored in OS keychain.
type Account struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Mirror    string `json:"mirror"`
	Currency  string `json:"currency"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// Store persists account metadata in SQLite.
type Store struct {
	db *sql.DB
}

// NewStore opens the SQLite auth DB and enables WAL.
func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("stakeauth: open db: %w", err)
	}
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("stakeauth: enable WAL: %w", err)
	}
	return &Store{db: db}, nil
}

// Close closes the DB.
func (s *Store) Close() error {
	return s.db.Close()
}

// Migrate creates tables and indexes.
func (s *Store) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS stake_accounts (
			id TEXT PRIMARY KEY,
			label TEXT NOT NULL DEFAULT '',
			mirror TEXT NOT NULL DEFAULT 'stake.com',
			currency TEXT NOT NULL DEFAULT 'btc',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_stake_accounts_updated_at ON stake_accounts(updated_at DESC)`,
	}
	for _, m := range migrations {
		if _, err := s.db.Exec(m); err != nil {
			return fmt.Errorf("stakeauth: migrate: %w", err)
		}
	}
	return nil
}

// List returns all accounts sorted by updated_at descending.
func (s *Store) List() ([]Account, error) {
	rows, err := s.db.Query(
		`SELECT id, label, mirror, currency, created_at, updated_at
		 FROM stake_accounts
		 ORDER BY updated_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("stakeauth: list: %w", err)
	}
	defer rows.Close()

	var out []Account
	for rows.Next() {
		var a Account
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&a.ID, &a.Label, &a.Mirror, &a.Currency, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("stakeauth: scan account: %w", err)
		}
		a.CreatedAt = createdAt.Format(time.RFC3339)
		a.UpdatedAt = updatedAt.Format(time.RFC3339)
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("stakeauth: iterate accounts: %w", err)
	}
	return out, nil
}

// Get returns a single account by id.
func (s *Store) Get(id string) (*Account, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("stakeauth: id is required")
	}

	var a Account
	var createdAt, updatedAt time.Time
	err := s.db.QueryRow(
		`SELECT id, label, mirror, currency, created_at, updated_at
		 FROM stake_accounts
		 WHERE id = ?`,
		id,
	).Scan(&a.ID, &a.Label, &a.Mirror, &a.Currency, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("stakeauth: account %q not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("stakeauth: get account: %w", err)
	}
	a.CreatedAt = createdAt.Format(time.RFC3339)
	a.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &a, nil
}

// Save upserts account metadata and returns the stored record.
func (s *Store) Save(acct Account) (Account, error) {
	if strings.TrimSpace(acct.ID) == "" {
		acct.ID = uuid.NewString()
	}
	if strings.TrimSpace(acct.Mirror) == "" {
		acct.Mirror = "stake.com"
	}
	if strings.TrimSpace(acct.Currency) == "" {
		acct.Currency = "btc"
	}
	acct.Label = strings.TrimSpace(acct.Label)

	_, err := s.db.Exec(
		`INSERT INTO stake_accounts (id, label, mirror, currency)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   label = excluded.label,
		   mirror = excluded.mirror,
		   currency = excluded.currency,
		   updated_at = CURRENT_TIMESTAMP`,
		acct.ID, acct.Label, acct.Mirror, acct.Currency,
	)
	if err != nil {
		return Account{}, fmt.Errorf("stakeauth: save account: %w", err)
	}

	saved, err := s.Get(acct.ID)
	if err != nil {
		return Account{}, err
	}
	return *saved, nil
}

// Delete removes account metadata.
func (s *Store) Delete(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("stakeauth: id is required")
	}
	_, err := s.db.Exec(`DELETE FROM stake_accounts WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("stakeauth: delete account: %w", err)
	}
	return nil
}
