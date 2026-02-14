package bindings

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/MJE43/stake-pf-replay-go/internal/scripting"
)

// ScriptModule is the Wails-bound struct for scripting engine management.
type ScriptModule struct {
	ctx    context.Context
	mu     sync.RWMutex
	engine *scripting.Engine

	// NoopBetPlacer is used until a real API client is wired in.
	placer scripting.BetPlacer

	// Event emitter for pushing state to the frontend.
	emitter *wailsScriptEmitter
}

// ScriptState is the frontend-facing snapshot of engine state.
type ScriptState struct {
	State         string                  `json:"state"`
	Error         string                  `json:"error,omitempty"`
	Bets          int                     `json:"bets"`
	Wins          int                     `json:"wins"`
	Losses        int                     `json:"losses"`
	Profit        float64                 `json:"profit"`
	Balance       float64                 `json:"balance"`
	Wagered       float64                 `json:"wagered"`
	WinStreak     int                     `json:"winStreak"`
	LoseStreak    int                     `json:"loseStreak"`
	CurrentGame   string                  `json:"currentGame"`
	BetsPerSecond float64                 `json:"betsPerSecond"`
	Chart         []scripting.ChartPoint  `json:"chart"`
}

// wailsScriptEmitter bridges scripting events to Wails runtime events.
type wailsScriptEmitter struct {
	ctx context.Context
}

func (e *wailsScriptEmitter) EmitScriptState(state scripting.EngineSnapshot) {
	if e.ctx == nil {
		return
	}
	// Wails EventsEmit is imported in the runtime package but we avoid
	// importing Wails in the backend module. Instead, the ScriptModule will
	// poll-style serve state via GetScriptState(). This emitter is a
	// placeholder for future Wails event integration from the root module.
}

func (e *wailsScriptEmitter) EmitScriptLog(entries []scripting.LogEntry) {
	// Same as above — placeholder.
}

// NewScriptModule creates a new ScriptModule ready to be bound.
func NewScriptModule() *ScriptModule {
	emitter := &wailsScriptEmitter{}
	return &ScriptModule{
		placer:  &SimulatedBetPlacer{},
		emitter: emitter,
	}
}

// Startup is called by Wails on application startup.
func (sm *ScriptModule) Startup(ctx context.Context) {
	sm.ctx = ctx
	sm.emitter.ctx = ctx
}

// StartScript starts the scripting engine with the given script.
func (sm *ScriptModule) StartScript(script string, game string, currency string, startBalance float64) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sm.engine != nil {
		if snap := sm.engine.GetState(); snap.State == scripting.StateRunning {
			if err := sm.engine.Stop(); err != nil {
				return fmt.Errorf("failed to stop running script: %w", err)
			}
		}
	}

	if startBalance <= 0 {
		startBalance = 1.0
	}
	if strings.TrimSpace(game) == "" {
		game = "dice"
	}
	if strings.TrimSpace(currency) == "" {
		currency = "trx"
	}

	// Create a fresh engine each time
	sm.engine = scripting.NewEngine(sm.placer, sm.emitter)

	bootstrap := fmt.Sprintf("game = %q\ncurrency = %q\n%s", game, currency, script)
	if err := sm.engine.Start(bootstrap, startBalance); err != nil {
		return fmt.Errorf("failed to start script: %w", err)
	}

	return nil
}

// StopScript stops the currently running script.
func (sm *ScriptModule) StopScript() error {
	sm.mu.RLock()
	eng := sm.engine
	sm.mu.RUnlock()

	if eng == nil {
		return fmt.Errorf("no script is running")
	}

	return eng.Stop()
}

// GetScriptState returns the current scripting engine state.
func (sm *ScriptModule) GetScriptState() ScriptState {
	sm.mu.RLock()
	eng := sm.engine
	sm.mu.RUnlock()

	if eng == nil {
		return ScriptState{State: string(scripting.StateIdle)}
	}

	snap := eng.GetState()
	state := ScriptState{
		State:         string(snap.State),
		Error:         snap.Error,
		CurrentGame:   snap.CurrentGame,
		BetsPerSecond: snap.BetsPerSecond,
	}

	if snap.Stats != nil {
		state.Bets = snap.Stats.Bets
		state.Wins = snap.Stats.Wins
		state.Losses = snap.Stats.Losses
		state.Profit = snap.Stats.Profit
		state.Balance = snap.Stats.Balance
		state.Wagered = snap.Stats.Wagered
		state.WinStreak = snap.Stats.WinStreak
		state.LoseStreak = snap.Stats.LoseStreak
	}

	if snap.Chart != nil {
		state.Chart = snap.Chart
	}

	return state
}

// GetScriptLog returns the script log buffer.
func (sm *ScriptModule) GetScriptLog() []scripting.LogEntry {
	sm.mu.RLock()
	eng := sm.engine
	sm.mu.RUnlock()

	if eng == nil {
		return nil
	}

	return eng.GetLogs()
}

// SimulatedBetPlacer is a placeholder that simulates bet results.
// This will be replaced with a real Stake API client in the future.
type SimulatedBetPlacer struct{}

func (s *SimulatedBetPlacer) PlaceBet(ctx context.Context, vars *scripting.Variables) (*scripting.BetResult, error) {
	// Simulate based on game type
	switch vars.Game {
	case "dice":
		return simulateDiceBet(vars), nil
	case "limbo":
		return simulateLimboBet(vars), nil
	default:
		return simulateGenericBet(vars), nil
	}
}

func simulateDiceBet(vars *scripting.Variables) *scripting.BetResult {
	// Simple simulation: win if chance > 50
	win := vars.Chance >= 50
	multi := 0.0
	if win {
		multi = 99.0 / vars.Chance
	}
	payout := 0.0
	if win {
		payout = vars.NextBet * multi
	}

	return &scripting.BetResult{
		Amount:      vars.NextBet,
		Payout:      payout,
		PayoutMulti: multi,
		Win:         win,
		Roll:        25.0, // simulated roll
		Chance:      vars.Chance,
		Target:      50.0,
	}
}

func simulateLimboBet(vars *scripting.Variables) *scripting.BetResult {
	// Simple simulation: always lose (target is typically > 1)
	return &scripting.BetResult{
		Amount:      vars.NextBet,
		Payout:      0,
		PayoutMulti: 0,
		Win:         false,
		Roll:        1.0,
		Target:      vars.Target,
	}
}

func simulateGenericBet(vars *scripting.Variables) *scripting.BetResult {
	// 50/50 simulation
	return &scripting.BetResult{
		Amount:      vars.NextBet,
		Payout:      0,
		PayoutMulti: 0,
		Win:         false,
		Roll:        0,
	}
}
