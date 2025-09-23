package livehttp

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/MJE43/stake-pf-replay-go-desktop/internal/livestore"
)

// LiveModule is a Wails-bound service that owns the DB and the local HTTP ingest server.
// UI calls its methods directly (bindings). Antebot posts to the local HTTP server.
// The module emits UI events on new rows via the ingest handler.
type LiveModule struct {
	ctx    context.Context
	store  *livestore.Store
	server *Server

	dbPath string
	port   int
	token  string
}

// NewLiveModule constructs the module but does not start the HTTP server.
// Call Startup(ctx) from your main.go OnStartup hook.
func NewLiveModule(dbPath string, port int, token string) (*LiveModule, error) {
	store, err := livestore.New(dbPath)
	if err != nil {
		return nil, err
	}
	m := &LiveModule{
		store:  store,
		dbPath: dbPath,
		port:   port,
		token:  token,
	}
	return m, nil
}

// Startup stores the Wails context and starts the local HTTP server.
func (m *LiveModule) Startup(ctx context.Context) error {
	m.ctx = ctx
	m.server = New(ctx, m.store, m.port, m.token)
	return m.server.Start()
}

// Shutdown stops the HTTP server and closes the DB.
func (m *LiveModule) Shutdown(ctx context.Context) error {
	_ = m.server.Shutdown(ctx)
	return m.store.Close()
}

// ------------- Wails binding methods (UI calls) -------------

// ListStreams returns recent streams with aggregates, ordered by last_seen_at desc.
func (m *LiveModule) ListStreams(limit int, offset int) ([]livestore.LiveStream, error) {
	return m.store.ListStreams(m.ctx, limit, offset)
}

// GetStream returns metadata and aggregates for a stream.
func (m *LiveModule) GetStream(streamID string) (livestore.LiveStream, error) {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return livestore.LiveStream{}, fmt.Errorf("invalid stream id: %w", err)
	}
	return m.store.GetStream(m.ctx, id)
}

// GetBets returns a page of bets for a stream.
// order: "asc" (by nonce asc) or "desc" (by nonce desc). Any other value defaults to "asc".
func (m *LiveModule) GetBets(streamID string, minMultiplier float64, order string, limit int, offset int) ([]livestore.LiveBet, int64, error) {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid stream id: %w", err)
	}
	return m.store.ListBets(m.ctx, id, minMultiplier, order, limit, offset)
}

// BetsPage is a convenience wrapper exposing both rows and total for frontend consumption.
type BetsPage struct {
	Rows  []livestore.LiveBet `json:"rows"`
	Total int64               `json:"total"`
}

// GetBetsPage returns the bets page along with the total row count.
func (m *LiveModule) GetBetsPage(streamID string, minMultiplier float64, order string, limit int, offset int) (BetsPage, error) {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return BetsPage{}, fmt.Errorf("invalid stream id: %w", err)
	}
	rows, total, err := m.store.ListBets(m.ctx, id, minMultiplier, order, limit, offset)
	if err != nil {
		return BetsPage{}, err
	}
	return BetsPage{Rows: rows, Total: total}, nil
}

// Tail returns bets with id > sinceID ordered by id ASC and the new lastID.
type TailResponse struct {
	Rows   []livestore.LiveBet `json:"rows"`
	LastID int64               `json:"lastID"`
}

func (m *LiveModule) Tail(streamID string, sinceID int64, limit int) (TailResponse, error) {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return TailResponse{}, fmt.Errorf("invalid stream id: %w", err)
	}
	rows, err := m.store.TailBets(m.ctx, id, sinceID, limit)
	if err != nil {
		return TailResponse{}, err
	}
	lastID := sinceID
	if len(rows) > 0 {
		lastID = rows[len(rows)-1].ID
	}
	return TailResponse{Rows: rows, LastID: lastID}, nil
}

// ExportCSV writes all bets for a stream to a temp CSV and returns the path.
// The file contains header: id,nonce,date_time,amount,payout,difficulty,round_target,round_result
func (m *LiveModule) ExportCSV(streamID string) (string, error) {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return "", fmt.Errorf("invalid stream id: %w", err)
	}
	dir := os.TempDir()
	name := fmt.Sprintf("stream_%s_%d.csv", id.String(), time.Now().UTC().UnixNano())
	path := filepath.Join(dir, name)

	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	if err := m.store.ExportCSV(m.ctx, f, id); err != nil {
		return "", err
	}
	return path, nil
}

// DeleteStream removes a stream and all its bets.
func (m *LiveModule) DeleteStream(streamID string) error {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return fmt.Errorf("invalid stream id: %w", err)
	}
	return m.store.DeleteStream(m.ctx, id)
}

// UpdateNotes sets the notes field on a stream.
func (m *LiveModule) UpdateNotes(streamID string, notes string) error {
	id, err := uuid.Parse(streamID)
	if err != nil {
		return fmt.Errorf("invalid stream id: %w", err)
	}
	return m.store.UpdateNotes(m.ctx, id, notes)
}

// IngestInfo returns the loopback URL Antebot should post to and whether a token is required.
// Useful to render in a Settings/About UI.
type IngestInfo struct {
	URL          string `json:"url"`
	TokenEnabled bool   `json:"tokenEnabled"`
}

func (m *LiveModule) IngestInfo() IngestInfo {
	return IngestInfo{
		URL:          fmt.Sprintf("http://127.0.0.1:%d/live/ingest", m.port),
		TokenEnabled: m.token != "",
	}
}

// EmitManualTick lets the UI force a "newrows" event (useful for testing the wiring).
func (m *LiveModule) EmitManualTick(streamID string) {
	runtime.EventsEmit(m.ctx, "live:newrows:"+streamID, map[string]any{"manual": true})
}

// **Next file suggestion:** wire the module into your Wails app lifecycle so it starts automatically.
// I’ll provide `cmd/app/main.go` (or adjust your existing `main.go`) to construct `LiveModule`,
// call `Startup` in `OnStartup`, `Shutdown` in `OnShutdown`, and bind the module so the frontend can call its methods.
