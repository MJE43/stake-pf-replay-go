-- +goose Up
CREATE TABLE runs (
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
);

CREATE TABLE hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    metric REAL NOT NULL,
    details TEXT,
    FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX idx_hits_run_id ON hits(run_id);
CREATE INDEX idx_hits_metric ON hits(run_id, metric);
CREATE INDEX idx_hits_nonce ON hits(run_id, nonce);

-- +goose Down
DROP INDEX IF EXISTS idx_hits_nonce;
DROP INDEX IF EXISTS idx_hits_metric;
DROP INDEX IF EXISTS idx_hits_run_id;
DROP TABLE IF EXISTS hits;
DROP TABLE IF EXISTS runs;