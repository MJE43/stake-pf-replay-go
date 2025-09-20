package livehttp

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/MJE43/stake-pf-replay-go-desktop/internal/livestore"
)

// Server runs a local HTTP API for Antebot ingest and UI queries.
type Server struct {
	store       *livestore.Store
	token       string
	addr        string // e.g. "127.0.0.1:8077"
	httpServer  *http.Server
	wailsCtx    context.Context
	writeTimout time.Duration
	readTimeout time.Duration
}

// New creates a live HTTP server bound to loopback at the given port.
// token may be empty to disable token checks.
func New(wailsCtx context.Context, store *livestore.Store, port int, token string) *Server {
	if port <= 0 {
		port = 8077
	}
	return &Server{
		store:       store,
		token:       token,
		addr:        fmt.Sprintf("127.0.0.1:%d", port),
		wailsCtx:    wailsCtx,
		writeTimout: 10 * time.Second,
		readTimeout: 10 * time.Second,
	}
}

// Start begins listening in a goroutine. It returns when the socket is bound.
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Ingest
	mux.HandleFunc("/live/ingest", s.handleIngest)

	// Streams
	mux.HandleFunc("/live/streams", s.handleStreams)
	mux.HandleFunc("/live/streams/", s.handleStreamSubroutes) // detail, bets, tail, export, notes, delete

	s.httpServer = &http.Server{
		Addr:         s.addr,
		Handler:      logRequest(mux),
		ReadTimeout:  s.readTimeout,
		WriteTimeout: s.writeTimout,
	}

	ln, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}
	go func() {
		_ = s.httpServer.Serve(ln)
	}()
	return nil
}

// Shutdown gracefully stops the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer == nil {
		return nil
	}
	return s.httpServer.Shutdown(ctx)
}

// ========== Handlers ==========

// POST /live/ingest
func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	if s.token != "" {
		if r.Header.Get("X-Ingest-Token") != s.token {
			writeJSON(w, http.StatusUnauthorized, errObj("UNAUTHORIZED", "missing or invalid X-Ingest-Token", ""))
			return
		}
	}

	var p ingestPayload
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&p); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, errObj("VALIDATION_ERROR", "invalid JSON", ""))
		return
	}
	// basic validation and normalization
	if p.ID == "" || p.ServerSeedHashed == "" || p.ClientSeed == "" {
		writeJSON(w, http.StatusUnprocessableEntity, errObj("VALIDATION_ERROR", "id, serverSeedHashed, and clientSeed are required", "id/serverSeedHashed/clientSeed"))
		return
	}
	if p.Nonce <= 0 {
		writeJSON(w, http.StatusUnprocessableEntity, errObj("VALIDATION_ERROR", "nonce must be >= 1", "nonce"))
		return
	}
	if p.Difficulty == "" {
		writeJSON(w, http.StatusUnprocessableEntity, errObj("VALIDATION_ERROR", "difficulty is required", "difficulty"))
		return
	}
	// Parse dateTime; if missing/invalid, use received time
	parsedDT := parseISOTimeOrNow(p.DateTime)

	// Find or create stream
	ctx := r.Context()
	streamID, err := s.store.FindOrCreateStream(ctx, p.ServerSeedHashed, p.ClientSeed)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to upsert stream", ""))
		return
	}

	// Build bet
	bet := livestore.LiveBet{
		StreamID:     streamID,
		AntebotBetID: p.ID,
		ReceivedAt:   time.Now().UTC(),
		DateTime:     parsedDT,
		Nonce:        int64(p.Nonce),
		Amount:       p.Amount,
		Payout:       p.Payout,
		Difficulty:   strings.ToLower(p.Difficulty),
		RoundTarget:  p.RoundTarget,
		RoundResult:  p.RoundResult,
	}

	res, err := s.store.IngestBet(ctx, streamID, bet)
	if err != nil && !res.Accepted {
		status := http.StatusInternalServerError
		if strings.Contains(strings.ToLower(err.Error()), "validation") {
			status = http.StatusUnprocessableEntity
		}
		writeJSON(w, status, map[string]any{"streamId": streamID.String(), "accepted": false, "error": err.Error()})
		return
	}

	// Emit event for UI if accepted
	if res.Accepted {
		runtime.EventsEmit(s.wailsCtx, "live:newrows:"+streamID.String(), map[string]any{
			"lastID": "unknown", // client will call /tail with its known lastID
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"streamId": streamID.String(),
		"accepted": res.Accepted,
	})
}

// GET /live/streams
func (s *Server) handleStreams(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		limit := clampInt(qInt(r, "limit", 100), 1, 500)
		offset := clampInt(qInt(r, "offset", 0), 0, 1_000_000)

		items, err := s.store.ListStreams(r.Context(), limit, offset)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to list streams", ""))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"streams": items,
			"count":   len(items),
		})
	default:
		methodNotAllowed(w, "GET")
	}
}

// /live/streams/{id}[/*]
func (s *Server) handleStreamSubroutes(w http.ResponseWriter, r *http.Request) {
	// Expect path: /live/streams/{id} or /live/streams/{id}/bets|tail|export.csv
	path := strings.TrimPrefix(r.URL.Path, "/live/streams/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	idStr := parts[0]
	streamID, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errObj("VALIDATION_ERROR", "invalid stream id", "id"))
		return
	}

	// Route by suffix
	if len(parts) == 1 || parts[1] == "" {
		switch r.Method {
		case http.MethodGet:
			s.handleStreamDetail(w, r, streamID)
			return
		case http.MethodDelete:
			s.handleStreamDelete(w, r, streamID)
			return
		case http.MethodPut:
			s.handleStreamUpdate(w, r, streamID)
			return
		default:
			methodNotAllowed(w, "GET, PUT, DELETE")
			return
		}
	}

	switch parts[1] {
	case "bets":
		if r.Method != http.MethodGet {
			methodNotAllowed(w, "GET")
			return
		}
		s.handleStreamBets(w, r, streamID)
		return
	case "tail":
		if r.Method != http.MethodGet {
			methodNotAllowed(w, "GET")
			return
		}
		s.handleStreamTail(w, r, streamID)
		return
	case "export.csv":
		if r.Method != http.MethodGet {
			methodNotAllowed(w, "GET")
			return
		}
		s.handleStreamExport(w, r, streamID)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

// GET /live/streams/{id}
func (s *Server) handleStreamDetail(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	item, err := s.store.GetStream(r.Context(), streamID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(w, http.StatusNotFound, errObj("NOT_FOUND", "stream not found", "id"))
		return
	case err != nil:
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to fetch stream", ""))
		return
	}
	writeJSON(w, http.StatusOK, item)
}

// DELETE /live/streams/{id}
func (s *Server) handleStreamDelete(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	if err := s.store.DeleteStream(r.Context(), streamID); err != nil {
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to delete stream", ""))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PUT /live/streams/{id}
func (s *Server) handleStreamUpdate(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	var body struct {
		Notes string `json:"notes"`
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, errObj("VALIDATION_ERROR", "invalid JSON", ""))
		return
	}
	if err := s.store.UpdateNotes(r.Context(), streamID, body.Notes); err != nil {
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to update notes", ""))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /live/streams/{id}/bets?min_multiplier=&limit=&offset=&order=
func (s *Server) handleStreamBets(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	minMul := qFloat(r, "min_multiplier", 0)
	limit := clampInt(qInt(r, "limit", 500), 1, 10000)
	offset := clampInt(qInt(r, "offset", 0), 0, 1_000_000)
	orderParam := r.URL.Query().Get("order")
	order := "asc"
	switch strings.ToLower(orderParam) {
	case "nonce_desc", "id_desc", "desc":
		order = "desc"
	case "nonce_asc", "asc", "":
		order = "asc"
	default:
		order = "asc"
	}

	rows, total, err := s.store.ListBets(r.Context(), streamID, minMul, order, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to list bets", ""))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"total": total,
		"rows":  rows,
	})
}

// GET /live/streams/{id}/tail?since_id=&limit=
func (s *Server) handleStreamTail(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	sinceID := qInt64(r, "since_id", 0)
	limit := clampInt(qInt(r, "limit", 1000), 1, 5000)

	rows, err := s.store.TailBets(r.Context(), streamID, sinceID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errObj("SERVER_ERROR", "failed to tail bets", ""))
		return
	}
	var lastID int64 = sinceID
	if len(rows) > 0 {
		lastID = rows[len(rows)-1].ID
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"rows":   rows,
		"lastID": lastID,
	})
}

// GET /live/streams/{id}/export.csv
func (s *Server) handleStreamExport(w http.ResponseWriter, r *http.Request, streamID uuid.UUID) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="stream_export.csv"`)

	// stream header and rows using store.ExportCSV, but ensure header consistent even on empty
	// We'll write via csv.Writer for safety on commas.
	// However, store.ExportCSV already writes CSV. Use it to avoid duplication.
	// Flush by closing response writer.
	if f, ok := w.(http.Flusher); ok {
		defer f.Flush()
	}

	// Write header via csv.Writer then rows from DB
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "nonce", "date_time", "amount", "payout", "difficulty", "round_target", "round_result"})
	cw.Flush()

	// Now write rows (append) ordered by nonce
	err := s.streamCSVAppend(r.Context(), w, streamID)
	if err != nil {
		// cannot change headers now; log-style write error message row
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	}
}

func (s *Server) streamCSVAppend(ctx context.Context, w http.ResponseWriter, streamID uuid.UUID) error {
	// Reuse store.ExportCSV but skip header (we already wrote it)
	// We'll query directly to avoid writing header twice.
	rows, err := s.storeTailAllForCSV(ctx, streamID)
	if err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	for _, rec := range rows {
		row := []string{
			strconv.FormatInt(rec.ID, 10),
			strconv.FormatInt(rec.Nonce, 10),
			rec.DateTime.UTC().Format(time.RFC3339Nano),
			strconv.FormatFloat(rec.Amount, 'f', 8, 64),
			strconv.FormatFloat(rec.Payout, 'f', 8, 64),
			rec.Difficulty,
			strconv.FormatFloat(rec.RoundTarget, 'f', 2, 64),
			strconv.FormatFloat(rec.RoundResult, 'f', 2, 64),
		}
		if err := cw.Write(row); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func (s *Server) storeTailAllForCSV(ctx context.Context, streamID uuid.UUID) ([]livestore.LiveBet, error) {
	// Fetch in chunks using TailBets
	var out []livestore.LiveBet
	var lastID int64 = 0
	for {
		chunk, err := s.store.TailBets(ctx, streamID, lastID, 2000)
		if err != nil {
			return nil, err
		}
		if len(chunk) == 0 {
			break
		}
		out = append(out, chunk...)
		lastID = chunk[len(chunk)-1].ID
	}
	return out, nil
}

// ========== Types & helpers ==========

type ingestPayload struct {
	ID               string  `json:"id"`
	DateTime         string  `json:"dateTime"`
	Nonce            int     `json:"nonce"`
	Amount           float64 `json:"amount"`
	Payout           float64 `json:"payout"`
	Difficulty       string  `json:"difficulty"` // easy|medium|hard|expert
	RoundTarget      float64 `json:"roundTarget"`
	RoundResult      float64 `json:"roundResult"` // source of truth multiplier
	ClientSeed       string  `json:"clientSeed"`
	ServerSeedHashed string  `json:"serverSeedHashed"`
}

func parseISOTimeOrNow(s string) time.Time {
	if s == "" {
		return time.Now().UTC()
	}
	// Try several layouts
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z07:00",
		"2006-01-02T15:04:05Z07:00",
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC()
		}
	}
	return time.Now().UTC()
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func errObj(code, msg, field string) map[string]any {
	e := map[string]any{
		"error": map[string]any{
			"code":    code,
			"message": msg,
		},
	}
	if field != "" {
		e["error"].(map[string]any)["field"] = field
	}
	return e
}

func methodNotAllowed(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	writeJSON(w, http.StatusMethodNotAllowed, errObj("METHOD_NOT_ALLOWED", "method not allowed", ""))
}

func qInt(r *http.Request, key string, def int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return def
	}
	i, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return i
}

func qInt64(r *http.Request, key string, def int64) int64 {
	s := r.URL.Query().Get(key)
	if s == "" {
		return def
	}
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return i
}

func qFloat(r *http.Request, key string, def float64) float64 {
	s := r.URL.Query().Get(key)
	if s == "" {
		return def
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return def
	}
	return f
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func logRequest(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		dur := time.Since(start)
		// Simple stdout log; Wails apps typically log to console
		fmt.Printf("[livehttp] %s %s %dms\n", r.Method, r.URL.Path, dur.Milliseconds())
	}
	return http.HandlerFunc(fn)
}

// What this file provides
//
// * Local HTTP API matching your FastAPI contract, now inside Wails.
// * `POST /live/ingest` with token check, normalization, idempotent insert, and **Wails event emit**.
// * Streams listing, detail, bets paging, tailing, CSV export, notes update, delete.
// * RFC3339 time parsing with fallback to `now` to satisfy the NOT NULL `date_time` column.
// * Loopback binding only.
//
// ### Next file
//
// If you want me to continue, I’ll wire this server into your Wails app entrypoint so it starts with the app and shuts down cleanly:
//
// * `internal/livehttp/bootstrap.go` or modify your `main.go` to construct `livestore.Store`, start `livehttp.Server`, and expose a small **Wails binding** for list/detail/bets/tail/export/delete if you prefer UI → bindings over fetch.
