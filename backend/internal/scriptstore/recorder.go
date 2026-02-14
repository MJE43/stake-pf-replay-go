package scriptstore

import (
	"log"
	"sync"
)

// SessionRecorder buffers bet results and periodically flushes them to the store.
// It is designed to be called from the scripting engine's bet loop.
type SessionRecorder struct {
	store     *Store
	sessionID string
	mu        sync.Mutex
	buffer    []ScriptBet
	nonce     int
	flushSize int
}

// NewSessionRecorder creates a recorder for the given session.
// flushSize controls how many bets are buffered before a batch insert.
func NewSessionRecorder(store *Store, sessionID string, flushSize int) *SessionRecorder {
	if flushSize <= 0 {
		flushSize = 50
	}
	return &SessionRecorder{
		store:     store,
		sessionID: sessionID,
		buffer:    make([]ScriptBet, 0, flushSize),
		flushSize: flushSize,
	}
}

// RecordBet adds a bet to the buffer and flushes if the buffer is full.
func (r *SessionRecorder) RecordBet(amount, payout, payoutMulti float64, win bool, roll *float64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.nonce++
	r.buffer = append(r.buffer, ScriptBet{
		SessionID:   r.sessionID,
		Nonce:       r.nonce,
		Amount:      amount,
		Payout:      payout,
		PayoutMulti: payoutMulti,
		Win:         win,
		Roll:        roll,
	})

	if len(r.buffer) >= r.flushSize {
		r.flushLocked()
	}
}

// Flush persists any remaining buffered bets to the store.
func (r *SessionRecorder) Flush() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.flushLocked()
}

func (r *SessionRecorder) flushLocked() {
	if len(r.buffer) == 0 {
		return
	}
	bets := make([]ScriptBet, len(r.buffer))
	copy(bets, r.buffer)
	r.buffer = r.buffer[:0]

	// Insert in background to avoid blocking the bet loop
	go func() {
		if err := r.store.InsertBetsBatch(r.sessionID, bets); err != nil {
			log.Printf("scriptstore: flush bets error: %v", err)
		}
	}()
}
