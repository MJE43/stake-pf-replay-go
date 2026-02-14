package scripting

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// State represents the scripting engine's lifecycle state.
type State string

const (
	StateIdle    State = "idle"
	StateRunning State = "running"
	StateStopped State = "stopped"
	StateError   State = "error"
)

// BetPlacer is the interface the engine uses to place bets.
// Implementations bridge to the Stake API client.
type BetPlacer interface {
	// PlaceBet places a bet using the current variable state and returns the result.
	PlaceBet(ctx context.Context, vars *Variables) (*BetResult, error)
}

// EventEmitter allows the engine to push state updates to the frontend.
type EventEmitter interface {
	// EmitScriptState sends the current engine state to the frontend.
	EmitScriptState(state EngineSnapshot)
	// EmitScriptLog sends log entries to the frontend.
	EmitScriptLog(entries []LogEntry)
}

// EngineSnapshot is a serializable snapshot of the engine state.
type EngineSnapshot struct {
	State         State       `json:"state"`
	Error         string      `json:"error,omitempty"`
	Stats         *Statistics `json:"stats"`
	Chart         []ChartPoint `json:"chart"`
	CurrentGame   string      `json:"currentGame"`
	CurrentNonce  int         `json:"currentNonce"`
	BetsPerSecond float64     `json:"betsPerSecond"`
}

// Engine is the main scripting engine that orchestrates the bet lifecycle.
type Engine struct {
	mu     sync.RWMutex
	state  State
	err    error
	cancel context.CancelFunc

	vm    *VM
	vars  *Variables
	stats *Statistics
	chart *ChartBuffer

	betPlacer BetPlacer
	emitter   EventEmitter

	startTime time.Time
}

// NewEngine creates a new scripting engine.
func NewEngine(placer BetPlacer, emitter EventEmitter) *Engine {
	return &Engine{
		state:     StateIdle,
		betPlacer: placer,
		emitter:   emitter,
	}
}

// Start begins script execution. The script source is executed once to
// register dobet() (and optionally round()), then the bet loop begins.
func (e *Engine) Start(script string, startBalance float64) error {
	e.mu.Lock()
	if e.state == StateRunning {
		e.mu.Unlock()
		return fmt.Errorf("engine is already running")
	}

	// Initialize fresh state
	e.stats = NewStatistics(startBalance)
	e.chart = NewChartBuffer(50)
	e.vars = NewVariables(e.stats)
	e.vm = NewVM()
	e.state = StateRunning
	e.err = nil
	e.startTime = time.Now()

	ctx, cancel := context.WithCancel(context.Background())
	e.cancel = cancel
	e.mu.Unlock()

	// Push initial variables into VM
	e.vm.SetVariables(e.vars)

	// Execute user script to register dobet() and round()
	if err := e.vm.Execute(script); err != nil {
		e.setError(err)
		cancel()
		return err
	}

	// Sync back any variables the script set during initialization
	e.vm.SyncVariables(e.vars)

	// Ensure dobet() is defined
	dobetVal := e.vm.runtime.Get("dobet")
	if dobetVal == nil || isUndefinedOrNull(dobetVal) {
		err := fmt.Errorf("script must define a dobet() function")
		e.setError(err)
		cancel()
		return err
	}

	// Set running state
	e.vars.Running = true
	e.vm.SetVariables(e.vars)

	// Emit initial state
	e.emitState()

	// Start bet loop in background
	go e.betLoop(ctx)

	return nil
}

// Stop gracefully stops the scripting engine.
func (e *Engine) Stop() error {
	e.mu.Lock()
	if e.state != StateRunning {
		e.mu.Unlock()
		return fmt.Errorf("engine is not running")
	}

	if e.cancel != nil {
		e.cancel()
	}
	e.state = StateStopped
	e.vars.Running = false
	e.mu.Unlock()

	e.emitState()
	return nil
}

// GetState returns the current engine snapshot.
func (e *Engine) GetState() EngineSnapshot {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.snapshot()
}

// GetLogs returns the script log buffer.
func (e *Engine) GetLogs() []LogEntry {
	if e.vm == nil {
		return nil
	}
	return e.vm.GetLogs()
}

// betLoop is the main betting loop that runs in a goroutine.
func (e *Engine) betLoop(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			e.setError(fmt.Errorf("script panic: %v", r))
		}
	}()

	for {
		select {
		case <-ctx.Done():
			e.mu.Lock()
			if e.state == StateRunning {
				e.state = StateStopped
			}
			e.vars.Running = false
			e.mu.Unlock()
			e.emitState()
			return
		default:
		}

		// Check if stop was requested
		if e.vm.IsStopRequested() {
			e.mu.Lock()
			e.state = StateStopped
			e.vars.Running = false
			e.mu.Unlock()
			e.emitState()
			return
		}

		// Validate bet amount with lock-protected read.
		e.mu.RLock()
		nextBet := e.vars.NextBet
		vars := e.vars
		e.mu.RUnlock()

		if nextBet <= 0 {
			e.setError(fmt.Errorf("nextbet must be > 0, got %f", nextBet))
			return
		}

		// 1. Place bet
		result, err := e.betPlacer.PlaceBet(ctx, vars)
		if err != nil {
			// Check if context was cancelled (graceful stop)
			if ctx.Err() != nil {
				e.mu.Lock()
				if e.state == StateRunning {
					e.state = StateStopped
				}
				e.vars.Running = false
				e.mu.Unlock()
				e.emitState()
				return
			}
			e.setError(fmt.Errorf("bet placement failed: %w", err))
			return
		}

		// 2. Update statistics and engine state under write lock.
		e.mu.Lock()
		e.stats.RecordBet(*result)

		// 3. Update variables from result
		e.vars.Win = result.Win
		e.vars.PreviousBet = result.Amount
		e.vars.Balance = e.stats.Balance
		e.vars.CashoutDone = true

		// 4. Update lastBet object
		e.vars.LastBet = map[string]interface{}{
			"amount":          result.Amount,
			"win":             result.Win,
			"Roll":            result.Roll,
			"payoutMultiplier": result.PayoutMulti,
			"chance":          result.Chance,
			"target":          result.Target,
			"payout":          result.Payout,
			"percent":         0.0,
			"targetNumber":    result.TargetNumber,
			"name":            nil,
		}

		// 5. Push updated state into VM
		e.vm.SetVariables(e.vars)

		// 6. Add chart data point
		e.chart.Push(ChartPoint{
			BetNumber: e.stats.Bets,
			Profit:    e.stats.Profit,
			Win:       result.Win,
		})
		e.mu.Unlock()

		// 7. Call dobet()
		if err := e.vm.CallDobet(); err != nil {
			e.setError(fmt.Errorf("dobet() error: %w", err))
			return
		}

		// 8. Sync variables back from VM
		e.vm.SyncVariables(e.vars)

		// 9. Check resetstats
		if e.vm.IsResetStatsRequested() {
			e.stats.Reset()
			e.chart.Reset()
			e.vm.SetVariables(e.vars)
		}

		// 10. Check stop conditions
		if e.vm.IsStopRequested() {
			e.mu.Lock()
			e.state = StateStopped
			e.vars.Running = false
			e.mu.Unlock()
			e.emitState()
			return
		}

		e.mu.RLock()
		stopOnWin := e.vars.StopOnWin
		e.mu.RUnlock()
		if stopOnWin && result.Win {
			e.mu.Lock()
			e.state = StateStopped
			e.vars.Running = false
			e.mu.Unlock()
			e.emitState()
			return
		}

		// 11. Emit state update (throttled: every bet for now; can add throttling later)
		e.emitState()

		// 12. Apply sleep delay
		sleepMs := e.vm.GetSleepTime()
		e.vm.ResetSleepTime()
		if sleepMs > 0 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Duration(sleepMs) * time.Millisecond):
			}
		}
	}
}

func (e *Engine) setError(err error) {
	e.mu.Lock()
	e.state = StateError
	e.err = err
	if e.vars != nil {
		e.vars.Running = false
	}
	e.mu.Unlock()
	e.emitState()
}

func (e *Engine) snapshot() EngineSnapshot {
	snap := EngineSnapshot{
		State: e.state,
	}
	if e.err != nil {
		snap.Error = e.err.Error()
	}
	if e.stats != nil {
		statsCopy := *e.stats
		snap.Stats = &statsCopy
	}
	if e.chart != nil {
		snap.Chart = append([]ChartPoint(nil), e.chart.Points...)
	}
	if e.vars != nil {
		snap.CurrentGame = e.vars.Game
	}
	if e.state == StateRunning && e.stats != nil && e.stats.Bets > 0 {
		elapsed := time.Since(e.startTime).Seconds()
		if elapsed > 0 {
			snap.BetsPerSecond = float64(e.stats.Bets) / elapsed
		}
	}
	return snap
}

func (e *Engine) emitState() {
	if e.emitter == nil {
		return
	}
	e.mu.RLock()
	snap := e.snapshot()
	e.mu.RUnlock()
	e.emitter.EmitScriptState(snap)
}

func isUndefinedOrNull(v interface{}) bool {
	if v == nil {
		return true
	}
	if gv, ok := v.(goja.Value); ok {
		return goja.IsUndefined(gv) || goja.IsNull(gv)
	}
	return false
}
