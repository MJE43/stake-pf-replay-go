-- +goose Up
-- Add server_seed_hash column and update schema for enhanced functionality
ALTER TABLE runs ADD COLUMN server_seed_hash TEXT;

-- Update existing runs to have server_seed_hash (this will be empty for existing data)
-- In production, this would need a data migration script

-- Add additional fields for enhanced functionality
ALTER TABLE runs ADD COLUMN params_json TEXT DEFAULT '{}';
ALTER TABLE runs ADD COLUMN tolerance REAL DEFAULT 0.0;
ALTER TABLE runs ADD COLUMN hit_limit INTEGER DEFAULT 1000;
ALTER TABLE runs ADD COLUMN timed_out INTEGER DEFAULT 0;
ALTER TABLE runs ADD COLUMN summary_min REAL;
ALTER TABLE runs ADD COLUMN summary_max REAL;
ALTER TABLE runs ADD COLUMN summary_sum REAL;
ALTER TABLE runs ADD COLUMN summary_count INTEGER DEFAULT 0;

-- Add indexes for performance on large datasets
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_game ON runs(game);
CREATE INDEX IF NOT EXISTS idx_runs_game_created ON runs(game, created_at DESC);

-- Optimize hits table indexes for pagination and delta nonce calculation
CREATE INDEX IF NOT EXISTS idx_hits_run_nonce ON hits(run_id, nonce);

-- +goose Down
-- Remove indexes
DROP INDEX IF EXISTS idx_hits_run_nonce;
DROP INDEX IF EXISTS idx_runs_game_created;
DROP INDEX IF EXISTS idx_runs_game;
DROP INDEX IF EXISTS idx_runs_created_at;

-- Remove columns (SQLite doesn't support DROP COLUMN easily, so we'd need to recreate table)
-- For now, just comment this out as it's complex in SQLite
-- ALTER TABLE runs DROP COLUMN summary_count;
-- ALTER TABLE runs DROP COLUMN summary_sum;
-- ALTER TABLE runs DROP COLUMN summary_max;
-- ALTER TABLE runs DROP COLUMN summary_min;
-- ALTER TABLE runs DROP COLUMN timed_out;
-- ALTER TABLE runs DROP COLUMN hit_limit;
-- ALTER TABLE runs DROP COLUMN tolerance;
-- ALTER TABLE runs DROP COLUMN params_json;
-- ALTER TABLE runs DROP COLUMN server_seed_hash;