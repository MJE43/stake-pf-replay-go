package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
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

func computeServerHash(serverSeed string) string {
	if serverSeed == "" {
		return ""
	}

	hash := sha256.Sum256([]byte(serverSeed))
	return hex.EncodeToString(hash[:])
}

// Close closes the database connection
func (s *SQLiteDB) Close() error {
	return s.db.Close()
}

// Migrate runs database migrations
func (s *SQLiteDB) Migrate() error {
	// First, create base tables
	baseMigrations := []string{
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

	for _, migration := range baseMigrations {
		if _, err := s.db.Exec(migration); err != nil {
			return fmt.Errorf("base migration failed: %w", err)
		}
	}

	// Then, add new columns if they don't exist
	alterMigrations := []string{
		`ALTER TABLE runs ADD COLUMN server_seed_hash TEXT`,
		`ALTER TABLE runs ADD COLUMN params_json TEXT DEFAULT '{}'`,
		`ALTER TABLE runs ADD COLUMN tolerance REAL DEFAULT 0.0`,
		`ALTER TABLE runs ADD COLUMN hit_limit INTEGER DEFAULT 1000`,
		`ALTER TABLE runs ADD COLUMN timed_out INTEGER DEFAULT 0`,
		`ALTER TABLE runs ADD COLUMN summary_min REAL`,
		`ALTER TABLE runs ADD COLUMN summary_max REAL`,
		`ALTER TABLE runs ADD COLUMN summary_sum REAL`,
		`ALTER TABLE runs ADD COLUMN summary_count INTEGER DEFAULT 0`,
	}

	for _, migration := range alterMigrations {
		if _, err := s.db.Exec(migration); err != nil {
			// Check if it's a duplicate column error (which is expected and safe to ignore)
			if !isDuplicateColumnError(err) {
				return fmt.Errorf("alter migration failed: %w", err)
			}
		}
	}

	// Finally, create performance indexes
	indexMigrations := []string{
		`CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_runs_game ON runs(game)`,
		`CREATE INDEX IF NOT EXISTS idx_runs_game_created ON runs(game, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_hits_run_nonce ON hits(run_id, nonce)`,
	}

	for _, migration := range indexMigrations {
		if _, err := s.db.Exec(migration); err != nil {
			return fmt.Errorf("index migration failed: %w", err)
		}
	}

	return nil
}

// isDuplicateColumnError checks if the error is a duplicate column error
func isDuplicateColumnError(err error) bool {
	errStr := err.Error()
	return errStr == "SQL logic error: duplicate column name: server_seed_hash (1)" ||
		errStr == "SQL logic error: duplicate column name: params_json (1)" ||
		errStr == "SQL logic error: duplicate column name: tolerance (1)" ||
		errStr == "SQL logic error: duplicate column name: hit_limit (1)" ||
		errStr == "SQL logic error: duplicate column name: timed_out (1)" ||
		errStr == "SQL logic error: duplicate column name: summary_min (1)" ||
		errStr == "SQL logic error: duplicate column name: summary_max (1)" ||
		errStr == "SQL logic error: duplicate column name: summary_sum (1)" ||
		errStr == "SQL logic error: duplicate column name: summary_count (1)"
}

// SaveRun saves a scan run to the database
func (s *SQLiteDB) SaveRun(run *Run) error {
	if run.ID == "" {
		run.ID = uuid.New().String()
	}

	query := `INSERT INTO runs (
		id, game, server_seed, server_seed_hash, client_seed, nonce_start, nonce_end,
		params_json, target_op, target_val, tolerance, hit_limit, timed_out,
		hit_count, total_evaluated, summary_min, summary_max, summary_sum, summary_count,
		engine_version
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	timedOutInt := 0
	if run.TimedOut {
		timedOutInt = 1
	}

	_, err := s.db.Exec(query,
		run.ID, run.Game, run.ServerSeed, run.ServerSeedHash, run.ClientSeed,
		run.NonceStart, run.NonceEnd, run.ParamsJSON, run.TargetOp, run.TargetVal,
		run.Tolerance, run.HitLimit, timedOutInt, run.HitCount, run.TotalEvaluated,
		run.SummaryMin, run.SummaryMax, run.SummarySum, run.SummaryCount,
		run.EngineVersion,
	)

	return err
}

// UpdateRun updates an existing run in the database
func (s *SQLiteDB) UpdateRun(run *Run) error {
	query := `UPDATE runs SET 
		game = ?, server_seed = ?, server_seed_hash = ?, client_seed = ?, 
		nonce_start = ?, nonce_end = ?, params_json = ?, target_op = ?, target_val = ?, 
		tolerance = ?, hit_limit = ?, timed_out = ?, hit_count = ?, total_evaluated = ?, 
		summary_min = ?, summary_max = ?, summary_sum = ?, summary_count = ?, engine_version = ?
		WHERE id = ?`

	timedOutInt := 0
	if run.TimedOut {
		timedOutInt = 1
	}

	_, err := s.db.Exec(query,
		run.Game, run.ServerSeed, run.ServerSeedHash, run.ClientSeed,
		run.NonceStart, run.NonceEnd, run.ParamsJSON, run.TargetOp, run.TargetVal,
		run.Tolerance, run.HitLimit, timedOutInt, run.HitCount, run.TotalEvaluated,
		run.SummaryMin, run.SummaryMax, run.SummarySum, run.SummaryCount,
		run.EngineVersion, run.ID,
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
	query := `SELECT 
		id, game, server_seed, server_seed_hash, client_seed, nonce_start, nonce_end,
		params_json, target_op, target_val, tolerance, hit_limit, timed_out,
		hit_count, total_evaluated, summary_min, summary_max, summary_sum, summary_count,
		engine_version, created_at
		FROM runs WHERE id = ?`

	var run Run
	var timedOutInt int
	var serverSeedHash, paramsJSON sql.NullString
	var summaryMin, summaryMax, summarySum sql.NullFloat64

	err := s.db.QueryRow(query, id).Scan(
		&run.ID, &run.Game, &run.ServerSeed, &serverSeedHash, &run.ClientSeed,
		&run.NonceStart, &run.NonceEnd, &paramsJSON, &run.TargetOp, &run.TargetVal,
		&run.Tolerance, &run.HitLimit, &timedOutInt, &run.HitCount, &run.TotalEvaluated,
		&summaryMin, &summaryMax, &summarySum, &run.SummaryCount,
		&run.EngineVersion, &run.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Handle nullable fields
	if serverSeedHash.Valid {
		run.ServerSeedHash = serverSeedHash.String
	}
	if paramsJSON.Valid {
		run.ParamsJSON = paramsJSON.String
	} else {
		run.ParamsJSON = "{}"
	}
	if summaryMin.Valid {
		run.SummaryMin = &summaryMin.Float64
	}
	if summaryMax.Valid {
		run.SummaryMax = &summaryMax.Float64
	}
	if summarySum.Valid {
		run.SummarySum = &summarySum.Float64
	}

	run.TimedOut = timedOutInt == 1

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

// ListRuns retrieves runs with pagination and filtering
func (s *SQLiteDB) ListRuns(query RunsQuery) (*RunsList, error) {
	// Build WHERE clause for filtering
	whereClause := ""
	args := []interface{}{}

	if query.Game != "" {
		whereClause = "WHERE game = ?"
		args = append(args, query.Game)
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM runs " + whereClause
	var totalCount int
	err := s.db.QueryRow(countQuery, args...).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	// Calculate pagination
	if query.PerPage <= 0 {
		query.PerPage = 50 // Default page size
	}
	if query.Page <= 0 {
		query.Page = 1
	}

	totalPages := (totalCount + query.PerPage - 1) / query.PerPage
	offset := (query.Page - 1) * query.PerPage

	// Build main query
	mainQuery := `SELECT 
		id, game, server_seed, server_seed_hash, client_seed, nonce_start, nonce_end,
		params_json, target_op, target_val, tolerance, hit_limit, timed_out,
		hit_count, total_evaluated, summary_min, summary_max, summary_sum, summary_count,
		engine_version, created_at
		FROM runs ` + whereClause + `
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?`

	args = append(args, query.PerPage, offset)

	rows, err := s.db.Query(mainQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query runs: %w", err)
	}
	defer rows.Close()

	var runs []Run
	for rows.Next() {
		var run Run
		var timedOutInt int
		var serverSeedHash, paramsJSON sql.NullString
		var summaryMin, summaryMax, summarySum sql.NullFloat64

		err := rows.Scan(
			&run.ID, &run.Game, &run.ServerSeed, &serverSeedHash, &run.ClientSeed,
			&run.NonceStart, &run.NonceEnd, &paramsJSON, &run.TargetOp, &run.TargetVal,
			&run.Tolerance, &run.HitLimit, &timedOutInt, &run.HitCount, &run.TotalEvaluated,
			&summaryMin, &summaryMax, &summarySum, &run.SummaryCount,
			&run.EngineVersion, &run.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan run: %w", err)
		}

		// Handle nullable fields
		if serverSeedHash.Valid {
			run.ServerSeedHash = serverSeedHash.String
		}
		if paramsJSON.Valid {
			run.ParamsJSON = paramsJSON.String
		} else {
			run.ParamsJSON = "{}"
		}
		if summaryMin.Valid {
			run.SummaryMin = &summaryMin.Float64
		}
		if summaryMax.Valid {
			run.SummaryMax = &summaryMax.Float64
		}
		if summarySum.Valid {
			run.SummarySum = &summarySum.Float64
		}

		run.TimedOut = timedOutInt == 1

		runs = append(runs, run)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating runs: %w", err)
	}

	return &RunsList{
		Runs:       runs,
		TotalCount: totalCount,
		Page:       query.Page,
		PerPage:    query.PerPage,
		TotalPages: totalPages,
	}, nil
}

// ListRunsBySeed returns all runs that share a server/client seed combination ordered by recency
func (s *SQLiteDB) ListRunsBySeed(serverSeedHash string, serverSeed string, clientSeed string) ([]Run, error) {
	if clientSeed == "" {
		return nil, fmt.Errorf("client seed is required")
	}

	targetHash := serverSeedHash
	if targetHash == "" {
		targetHash = computeServerHash(serverSeed)
	}

	query := `SELECT 
		id, game, server_seed, server_seed_hash, client_seed, nonce_start, nonce_end,
		params_json, target_op, target_val, tolerance, hit_limit, timed_out,
		hit_count, total_evaluated, summary_min, summary_max, summary_sum, summary_count,
		engine_version, created_at
		FROM runs WHERE client_seed = ?
		ORDER BY created_at DESC`

	rows, err := s.db.Query(query, clientSeed)
	if err != nil {
		return nil, fmt.Errorf("failed to query runs by seed: %w", err)
	}
	defer rows.Close()

	var runs []Run
	for rows.Next() {
		var run Run
		var timedOutInt int
		var serverSeedHashSQL, paramsJSON sql.NullString
		var summaryMin, summaryMax, summarySum sql.NullFloat64

		err := rows.Scan(
			&run.ID, &run.Game, &run.ServerSeed, &serverSeedHashSQL, &run.ClientSeed,
			&run.NonceStart, &run.NonceEnd, &paramsJSON, &run.TargetOp, &run.TargetVal,
			&run.Tolerance, &run.HitLimit, &timedOutInt, &run.HitCount, &run.TotalEvaluated,
			&summaryMin, &summaryMax, &summarySum, &run.SummaryCount,
			&run.EngineVersion, &run.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan run: %w", err)
		}

		if serverSeedHashSQL.Valid {
			run.ServerSeedHash = serverSeedHashSQL.String
		}
		if paramsJSON.Valid {
			run.ParamsJSON = paramsJSON.String
		} else {
			run.ParamsJSON = "{}"
		}
		if summaryMin.Valid {
			run.SummaryMin = &summaryMin.Float64
		}
		if summaryMax.Valid {
			run.SummaryMax = &summaryMax.Float64
		}
		if summarySum.Valid {
			run.SummarySum = &summarySum.Float64
		}

		run.TimedOut = timedOutInt == 1

		candidateHash := run.ServerSeedHash
		if candidateHash == "" {
			candidateHash = computeServerHash(run.ServerSeed)
		}

		matchesHash := targetHash != "" && candidateHash != "" && candidateHash == targetHash
		matchesPlain := serverSeed != "" && run.ServerSeed == serverSeed
		if matchesHash || matchesPlain {
			runs = append(runs, run)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating runs by seed: %w", err)
	}

	return runs, nil
}

// GetRunHits retrieves hits for a run with server-side pagination and delta nonce calculation
func (s *SQLiteDB) GetRunHits(runID string, page, perPage int) (*HitsPage, error) {
	// Get total count
	var totalCount int
	err := s.db.QueryRow("SELECT COUNT(*) FROM hits WHERE run_id = ?", runID).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get hits count: %w", err)
	}

	// Calculate pagination
	if perPage <= 0 {
		perPage = 100 // Default page size
	}
	if page <= 0 {
		page = 1
	}

	totalPages := (totalCount + perPage - 1) / perPage
	offset := (page - 1) * perPage

	// Query hits with pagination
	query := `SELECT id, run_id, nonce, metric, details 
		FROM hits WHERE run_id = ? 
		ORDER BY nonce 
		LIMIT ? OFFSET ?`

	rows, err := s.db.Query(query, runID, perPage, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query hits: %w", err)
	}
	defer rows.Close()

	var hits []Hit
	for rows.Next() {
		var hit Hit
		var details sql.NullString

		err := rows.Scan(&hit.ID, &hit.RunID, &hit.Nonce, &hit.Metric, &details)
		if err != nil {
			return nil, fmt.Errorf("failed to scan hit: %w", err)
		}

		if details.Valid {
			hit.Details = details.String
		}

		hits = append(hits, hit)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating hits: %w", err)
	}

	// Calculate delta nonces
	hitsWithDelta := make([]HitWithDelta, len(hits))
	for i, hit := range hits {
		hitsWithDelta[i] = HitWithDelta{Hit: hit}

		// Calculate delta nonce (distance from previous hit)
		if i > 0 {
			delta := hit.Nonce - hits[i-1].Nonce
			hitsWithDelta[i].DeltaNonce = &delta
		} else if page > 1 {
			// For first hit on non-first page, get the last hit from previous page
			prevHitQuery := `SELECT nonce FROM hits WHERE run_id = ? AND nonce < ? ORDER BY nonce DESC LIMIT 1`
			var prevNonce uint64
			err := s.db.QueryRow(prevHitQuery, runID, hit.Nonce).Scan(&prevNonce)
			if err == nil {
				delta := hit.Nonce - prevNonce
				hitsWithDelta[i].DeltaNonce = &delta
			}
			// If error (no previous hit), delta remains nil which is correct
		}
		// For first hit on first page, delta is nil (no previous hit)
	}

	return &HitsPage{
		Hits:       hitsWithDelta,
		TotalCount: totalCount,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	}, nil
}
