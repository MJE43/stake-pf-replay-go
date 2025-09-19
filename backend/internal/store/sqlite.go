package store

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// SQLiteDB implements the DB interface using SQLite
type SQLiteDB struct {
	db *sql.DB
}

// NewSQLiteDB creates a new SQLite database connection
func NewSQLiteDB(path string) (*SQLiteDB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	
	// Enable WAL mode for better concurrency
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}
	
	return &SQLiteDB{db: db}, nil
}

// Close closes the database connection
func (s *SQLiteDB) Close() error {
	return s.db.Close()
}

// Migrate runs database migrations
func (s *SQLiteDB) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			game TEXT NOT NULL,
			server_seed TEXT NOT NULL,
			client_seed TEXT NOT NULL,
			nonce_start INTEGER NOT NULL,
			nonce_end INTEGER NOT NULL,
			target_op TEXT NOT NULL,
			target_val REAL NOT NULL,
			hit_count INTEGER NOT NULL DEFAULT 0,
			total_evaluated INTEGER NOT NULL DEFAULT 0,
			engine_version TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS hits (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			run_id TEXT NOT NULL,
			nonce INTEGER NOT NULL,
			metric REAL NOT NULL,
			details TEXT,
			FOREIGN KEY (run_id) REFERENCES runs(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_hits_run_id ON hits(run_id)`,
		`CREATE INDEX IF NOT EXISTS idx_hits_metric ON hits(run_id, metric)`,
		`CREATE INDEX IF NOT EXISTS idx_hits_nonce ON hits(run_id, nonce)`,
	}
	
	for _, migration := range migrations {
		if _, err := s.db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	
	return nil
}

// SaveRun saves a scan run to the database
func (s *SQLiteDB) SaveRun(run *Run) error {
	if run.ID == "" {
		run.ID = uuid.New().String()
	}
	
	query := `INSERT INTO runs (
		id, game, server_seed, client_seed, nonce_start, nonce_end,
		target_op, target_val, hit_count, total_evaluated, engine_version
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	
	_, err := s.db.Exec(query,
		run.ID, run.Game, run.ServerSeed, run.ClientSeed,
		run.NonceStart, run.NonceEnd, run.TargetOp, run.TargetVal,
		run.HitCount, run.TotalEvaluated, run.EngineVersion,
	)
	
	return err
}

// SaveHits saves multiple hits to the database
func (s *SQLiteDB) SaveHits(runID string, hits []Hit) error {
	if len(hits) == 0 {
		return nil
	}
	
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	stmt, err := tx.Prepare("INSERT INTO hits (run_id, nonce, metric, details) VALUES (?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()
	
	for _, hit := range hits {
		var detailsJSON string
		if hit.Details != "" {
			detailsJSON = hit.Details
		}
		
		_, err := stmt.Exec(runID, hit.Nonce, hit.Metric, detailsJSON)
		if err != nil {
			return err
		}
	}
	
	return tx.Commit()
}

// GetRun retrieves a run by ID
func (s *SQLiteDB) GetRun(id string) (*Run, error) {
	query := `SELECT id, game, server_seed, client_seed, nonce_start, nonce_end,
		target_op, target_val, hit_count, total_evaluated, engine_version, created_at
		FROM runs WHERE id = ?`
	
	var run Run
	err := s.db.QueryRow(query, id).Scan(
		&run.ID, &run.Game, &run.ServerSeed, &run.ClientSeed,
		&run.NonceStart, &run.NonceEnd, &run.TargetOp, &run.TargetVal,
		&run.HitCount, &run.TotalEvaluated, &run.EngineVersion, &run.CreatedAt,
	)
	
	if err != nil {
		return nil, err
	}
	
	return &run, nil
}

// GetHits retrieves hits for a run with pagination
func (s *SQLiteDB) GetHits(runID string, limit, offset int) ([]Hit, error) {
	query := `SELECT id, run_id, nonce, metric, details 
		FROM hits WHERE run_id = ? 
		ORDER BY nonce LIMIT ? OFFSET ?`
	
	rows, err := s.db.Query(query, runID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var hits []Hit
	for rows.Next() {
		var hit Hit
		var details sql.NullString
		
		err := rows.Scan(&hit.ID, &hit.RunID, &hit.Nonce, &hit.Metric, &details)
		if err != nil {
			return nil, err
		}
		
		if details.Valid {
			hit.Details = details.String
		}
		
		hits = append(hits, hit)
	}
	
	return hits, rows.Err()
}