// Package scriptstore provides SQLite persistence for scripting engine sessions.
package scriptstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// ScriptSession represents a scripting engine session.
type ScriptSession struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Game          string     `json:"game"`
	Currency      string     `json:"currency"`
	Mode          string     `json:"mode"`
	ScriptSource  string     `json:"scriptSource"`
	StartBalance  float64    `json:"startBalance"`
	FinalBalance  *float64   `json:"finalBalance,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	EndedAt       *time.Time `json:"endedAt,omitempty"`
	FinalState    string     `json:"finalState"`
	TotalBets     int        `json:"totalBets"`
	TotalWins     int        `json:"totalWins"`
	TotalLosses   int        `json:"totalLosses"`
	TotalProfit   float64    `json:"totalProfit"`
	TotalWagered  float64    `json:"totalWagered"`
	HighestStreak int        `json:"highestStreak"`
	LowestStreak  int        `json:"lowestStreak"`
}

// ScriptBet represents a single bet within a session.
type ScriptBet struct {
	ID          int64     `json:"id"`
	SessionID   string    `json:"sessionId"`
	Nonce       int       `json:"nonce"`
	Amount      float64   `json:"amount"`
	Payout      float64   `json:"payout"`
	PayoutMulti float64   `json:"payoutMulti"`
	Win         bool      `json:"win"`
	Roll        *float64  `json:"roll,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ScriptBetsPage is a paginated bets response.
type ScriptBetsPage struct {
	Bets       []ScriptBet `json:"bets"`
	TotalCount int         `json:"totalCount"`
	Page       int         `json:"page"`
	PerPage    int         `json:"perPage"`
	TotalPages int         `json:"totalPages"`
}

// Store provides SQLite persistence for script sessions.
type Store struct {
	db *sql.DB
}

// New creates a new script store using the given SQLite database path.
func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("scriptstore: open db: %w", err)
	}
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("scriptstore: enable WAL: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("scriptstore: enable foreign keys: %w", err)
	}
	return &Store{db: db}, nil
}

// NewFromDB wraps an existing sql.DB.
func NewFromDB(db *sql.DB) *Store {
	return &Store{db: db}
}

// Migrate runs the script session migrations.
func (s *Store) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS script_sessions (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL DEFAULT '',
			game TEXT NOT NULL,
			currency TEXT NOT NULL,
			mode TEXT NOT NULL DEFAULT 'simulated',
			script_source TEXT NOT NULL DEFAULT '',
			start_balance REAL NOT NULL DEFAULT 0,
			final_balance REAL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			ended_at DATETIME,
			final_state TEXT NOT NULL DEFAULT 'running',
			total_bets INTEGER NOT NULL DEFAULT 0,
			total_wins INTEGER NOT NULL DEFAULT 0,
			total_losses INTEGER NOT NULL DEFAULT 0,
			total_profit REAL NOT NULL DEFAULT 0,
			total_wagered REAL NOT NULL DEFAULT 0,
			highest_streak INTEGER NOT NULL DEFAULT 0,
			lowest_streak INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS script_bets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			nonce INTEGER NOT NULL,
			amount REAL NOT NULL,
			payout REAL NOT NULL,
			payout_multi REAL NOT NULL DEFAULT 0,
			win BOOLEAN NOT NULL DEFAULT 0,
			roll REAL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES script_sessions(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_script_bets_session ON script_bets(session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_script_bets_session_nonce ON script_bets(session_id, nonce)`,
		`CREATE TABLE IF NOT EXISTS script_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			bet_number INTEGER NOT NULL,
			stats_json TEXT NOT NULL,
			vars_json TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES script_sessions(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_script_snapshots_session ON script_snapshots(session_id)`,
	}
	for _, m := range migrations {
		if _, err := s.db.Exec(m); err != nil {
			return fmt.Errorf("scriptstore: migrate: %w", err)
		}
	}
	return nil
}

// Close closes the database.
func (s *Store) Close() error {
	return s.db.Close()
}

// CreateSession inserts a new script session and returns its ID.
func (s *Store) CreateSession(sess *ScriptSession) (string, error) {
	if sess.ID == "" {
		sess.ID = uuid.NewString()
	}
	_, err := s.db.Exec(
		`INSERT INTO script_sessions (id, name, game, currency, mode, script_source, start_balance, final_state)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		sess.ID, sess.Name, sess.Game, sess.Currency, sess.Mode, sess.ScriptSource, sess.StartBalance, "running",
	)
	if err != nil {
		return "", fmt.Errorf("scriptstore: create session: %w", err)
	}
	return sess.ID, nil
}

// EndSession marks a session as ended with final stats.
func (s *Store) EndSession(id string, finalState string, stats SessionStats) error {
	now := time.Now()
	_, err := s.db.Exec(
		`UPDATE script_sessions SET
			ended_at = ?, final_state = ?, final_balance = ?,
			total_bets = ?, total_wins = ?, total_losses = ?,
			total_profit = ?, total_wagered = ?,
			highest_streak = ?, lowest_streak = ?
		 WHERE id = ?`,
		now, finalState, stats.FinalBalance,
		stats.TotalBets, stats.TotalWins, stats.TotalLosses,
		stats.TotalProfit, stats.TotalWagered,
		stats.HighestStreak, stats.LowestStreak,
		id,
	)
	if err != nil {
		return fmt.Errorf("scriptstore: end session: %w", err)
	}
	return nil
}

// SessionStats holds final stats for ending a session.
type SessionStats struct {
	FinalBalance  float64
	TotalBets     int
	TotalWins     int
	TotalLosses   int
	TotalProfit   float64
	TotalWagered  float64
	HighestStreak int
	LowestStreak  int
}

// InsertBet records a single bet result.
func (s *Store) InsertBet(sessionID string, bet *ScriptBet) error {
	_, err := s.db.Exec(
		`INSERT INTO script_bets (session_id, nonce, amount, payout, payout_multi, win, roll)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sessionID, bet.Nonce, bet.Amount, bet.Payout, bet.PayoutMulti, bet.Win, bet.Roll,
	)
	if err != nil {
		return fmt.Errorf("scriptstore: insert bet: %w", err)
	}
	return nil
}

// InsertBetsBatch records multiple bets in a single transaction for efficiency.
func (s *Store) InsertBetsBatch(sessionID string, bets []ScriptBet) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("scriptstore: begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO script_bets (session_id, nonce, amount, payout, payout_multi, win, roll)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return fmt.Errorf("scriptstore: prepare: %w", err)
	}
	defer stmt.Close()

	for _, b := range bets {
		_, err := stmt.Exec(sessionID, b.Nonce, b.Amount, b.Payout, b.PayoutMulti, b.Win, b.Roll)
		if err != nil {
			return fmt.Errorf("scriptstore: insert bet #%d: %w", b.Nonce, err)
		}
	}
	return tx.Commit()
}

// InsertSnapshot saves a periodic snapshot of the session state.
func (s *Store) InsertSnapshot(sessionID string, betNumber int, stats interface{}, vars interface{}) error {
	statsJSON, err := json.Marshal(stats)
	if err != nil {
		return fmt.Errorf("scriptstore: marshal stats: %w", err)
	}
	varsJSON, err := json.Marshal(vars)
	if err != nil {
		return fmt.Errorf("scriptstore: marshal vars: %w", err)
	}
	_, err = s.db.Exec(
		`INSERT INTO script_snapshots (session_id, bet_number, stats_json, vars_json)
		 VALUES (?, ?, ?, ?)`,
		sessionID, betNumber, string(statsJSON), string(varsJSON),
	)
	if err != nil {
		return fmt.Errorf("scriptstore: insert snapshot: %w", err)
	}
	return nil
}

// GetSession fetches a session by ID.
func (s *Store) GetSession(id string) (*ScriptSession, error) {
	sess := &ScriptSession{}
	err := s.db.QueryRow(
		`SELECT id, name, game, currency, mode, script_source, start_balance, final_balance,
		        created_at, ended_at, final_state, total_bets, total_wins, total_losses,
		        total_profit, total_wagered, highest_streak, lowest_streak
		 FROM script_sessions WHERE id = ?`, id,
	).Scan(
		&sess.ID, &sess.Name, &sess.Game, &sess.Currency, &sess.Mode, &sess.ScriptSource,
		&sess.StartBalance, &sess.FinalBalance, &sess.CreatedAt, &sess.EndedAt,
		&sess.FinalState, &sess.TotalBets, &sess.TotalWins, &sess.TotalLosses,
		&sess.TotalProfit, &sess.TotalWagered, &sess.HighestStreak, &sess.LowestStreak,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("scriptstore: session %q not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("scriptstore: get session: %w", err)
	}
	return sess, nil
}

// ListSessions returns sessions ordered by creation date (newest first).
func (s *Store) ListSessions(limit, offset int) ([]ScriptSession, int, error) {
	if limit <= 0 {
		limit = 20
	}

	var total int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM script_sessions").Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("scriptstore: count sessions: %w", err)
	}

	rows, err := s.db.Query(
		`SELECT id, name, game, currency, mode, script_source, start_balance, final_balance,
		        created_at, ended_at, final_state, total_bets, total_wins, total_losses,
		        total_profit, total_wagered, highest_streak, lowest_streak
		 FROM script_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("scriptstore: list sessions: %w", err)
	}
	defer rows.Close()

	var sessions []ScriptSession
	for rows.Next() {
		sess := ScriptSession{}
		err := rows.Scan(
			&sess.ID, &sess.Name, &sess.Game, &sess.Currency, &sess.Mode, &sess.ScriptSource,
			&sess.StartBalance, &sess.FinalBalance, &sess.CreatedAt, &sess.EndedAt,
			&sess.FinalState, &sess.TotalBets, &sess.TotalWins, &sess.TotalLosses,
			&sess.TotalProfit, &sess.TotalWagered, &sess.HighestStreak, &sess.LowestStreak,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scriptstore: scan session: %w", err)
		}
		sessions = append(sessions, sess)
	}

	return sessions, total, nil
}

// GetSessionBets returns paginated bets for a session.
func (s *Store) GetSessionBets(sessionID string, page, perPage int) (*ScriptBetsPage, error) {
	if page < 1 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	var total int
	if err := s.db.QueryRow(
		"SELECT COUNT(*) FROM script_bets WHERE session_id = ?", sessionID,
	).Scan(&total); err != nil {
		return nil, fmt.Errorf("scriptstore: count bets: %w", err)
	}

	rows, err := s.db.Query(
		`SELECT id, session_id, nonce, amount, payout, payout_multi, win, roll, created_at
		 FROM script_bets WHERE session_id = ? ORDER BY nonce DESC LIMIT ? OFFSET ?`,
		sessionID, perPage, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("scriptstore: get session bets: %w", err)
	}
	defer rows.Close()

	var bets []ScriptBet
	for rows.Next() {
		b := ScriptBet{}
		if err := rows.Scan(&b.ID, &b.SessionID, &b.Nonce, &b.Amount, &b.Payout, &b.PayoutMulti, &b.Win, &b.Roll, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scriptstore: scan bet: %w", err)
		}
		bets = append(bets, b)
	}

	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}

	return &ScriptBetsPage{
		Bets:       bets,
		TotalCount: total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	}, nil
}

// DeleteSession removes a session and all associated bets/snapshots.
func (s *Store) DeleteSession(id string) error {
	// Foreign keys with CASCADE handle bets and snapshots
	_, err := s.db.Exec("DELETE FROM script_sessions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("scriptstore: delete session: %w", err)
	}
	return nil
}
