-- Script session persistence tables
-- Tracks scripting engine sessions, individual bets, and periodic snapshots.

CREATE TABLE IF NOT EXISTS script_sessions (
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
);

CREATE TABLE IF NOT EXISTS script_bets (
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
);

CREATE INDEX IF NOT EXISTS idx_script_bets_session ON script_bets(session_id);
CREATE INDEX IF NOT EXISTS idx_script_bets_session_nonce ON script_bets(session_id, nonce);

CREATE TABLE IF NOT EXISTS script_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    bet_number INTEGER NOT NULL,
    stats_json TEXT NOT NULL,
    vars_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES script_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_script_snapshots_session ON script_snapshots(session_id);
