package scripting

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// LogEntry represents a single log message from the script.
type LogEntry struct {
	Time    time.Time `json:"time"`
	Message string    `json:"message"`
}

// VM wraps a goja runtime with sandbox restrictions and global function injection.
type VM struct {
	runtime *goja.Runtime
	mu      sync.Mutex

	// Log buffer visible to the frontend.
	logs    []LogEntry
	logsMu  sync.Mutex
	maxLogs int

	// stopRequested is set when the script calls stop().
	stopRequested bool
}

const (
	scriptInitTimeout = 2 * time.Second
	scriptCallTimeout = 1 * time.Second
)

// NewVM creates a sandboxed goja runtime with global functions injected.
func NewVM() *VM {
	vm := &VM{
		runtime: goja.New(),
		maxLogs: 500,
	}
	vm.injectGlobalFunctions()
	injectConstants(vm.runtime)
	return vm
}

// injectGlobalFunctions registers log, sleep, stop, resetstats, and console.log.
func (vm *VM) injectGlobalFunctions() {
	// log(...args) — appends to log buffer
	vm.runtime.Set("log", func(call goja.FunctionCall) goja.Value {
		parts := make([]string, len(call.Arguments))
		for i, arg := range call.Arguments {
			parts[i] = arg.String()
		}
		msg := strings.Join(parts, " ")

		vm.logsMu.Lock()
		if len(vm.logs) >= vm.maxLogs {
			vm.logs = vm.logs[1:]
		}
		vm.logs = append(vm.logs, LogEntry{Time: time.Now(), Message: msg})
		vm.logsMu.Unlock()

		return goja.Undefined()
	})

	// console.log — alias for log
	console := vm.runtime.NewObject()
	console.Set("log", vm.runtime.Get("log"))
	vm.runtime.Set("console", console)

	// stop() — signals the engine to stop
	vm.runtime.Set("stop", func(call goja.FunctionCall) goja.Value {
		vm.mu.Lock()
		vm.stopRequested = true
		vm.mu.Unlock()
		vm.runtime.Set("running", false)
		return goja.Undefined()
	})

	// sleep(ms) — sets the sleeptime variable
	vm.runtime.Set("sleep", func(call goja.FunctionCall) goja.Value {
		ms := 0
		if len(call.Arguments) > 0 {
			ms = int(call.Arguments[0].ToInteger())
		}
		vm.runtime.Set("sleeptime", ms)
		return goja.Undefined()
	})

	// resetstats() — placeholder, actual reset happens in engine
	vm.runtime.Set("resetstats", func(call goja.FunctionCall) goja.Value {
		// The engine lifecycle checks this flag after dobet() returns.
		vm.runtime.Set("_resetstats", true)
		return goja.Undefined()
	})

	// Math is already available in goja by default.
	// Block dangerous globals.
	vm.runtime.Set("require", goja.Undefined())
	vm.runtime.Set("fetch", goja.Undefined())
	vm.runtime.Set("XMLHttpRequest", goja.Undefined())
	vm.runtime.Set("eval", goja.Undefined())
	vm.runtime.Set("Function", goja.Undefined())
}

// Execute runs user script source code. This should be called once at the
// start of a session to register dobet() and optionally round().
func (vm *VM) Execute(source string) error {
	return vm.runWithTimeout(scriptInitTimeout, func() error {
		vm.mu.Lock()
		defer vm.mu.Unlock()
		_, err := vm.runtime.RunString(source)
		if err != nil {
			return fmt.Errorf("script execution error: %w", err)
		}
		return nil
	})
}

// CallDobet calls the user-defined dobet() function.
func (vm *VM) CallDobet() error {
	return vm.runWithTimeout(scriptCallTimeout, func() error {
		vm.mu.Lock()
		defer vm.mu.Unlock()

		fn := vm.runtime.Get("dobet")
		if fn == nil || goja.IsUndefined(fn) || goja.IsNull(fn) {
			return fmt.Errorf("dobet() function is not defined")
		}

		callable, ok := goja.AssertFunction(fn)
		if !ok {
			return fmt.Errorf("dobet is not a function")
		}

		_, err := callable(goja.Undefined())
		if err != nil {
			return fmt.Errorf("dobet() error: %w", err)
		}
		return nil
	})
}

// CallRound calls the user-defined round() function for multi-round games.
// Returns the action value (int for HiLo, string for Blackjack).
func (vm *VM) CallRound() (goja.Value, error) {
	var out goja.Value
	err := vm.runWithTimeout(scriptCallTimeout, func() error {
		vm.mu.Lock()
		defer vm.mu.Unlock()

		fn := vm.runtime.Get("round")
		if fn == nil || goja.IsUndefined(fn) || goja.IsNull(fn) {
			return fmt.Errorf("round() function is not defined")
		}

		callable, ok := goja.AssertFunction(fn)
		if !ok {
			return fmt.Errorf("round is not a function")
		}

		result, err := callable(goja.Undefined())
		if err != nil {
			return fmt.Errorf("round() error: %w", err)
		}
		out = result
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// HasRoundFunc returns true if the user script defined a round() function.
func (vm *VM) HasRoundFunc() bool {
	fn := vm.runtime.Get("round")
	if fn == nil || goja.IsUndefined(fn) || goja.IsNull(fn) {
		return false
	}
	_, ok := goja.AssertFunction(fn)
	return ok
}

// IsStopRequested returns true if stop() was called from the script.
func (vm *VM) IsStopRequested() bool {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	return vm.stopRequested
}

// ClearStopRequest clears the stop request flag.
func (vm *VM) ClearStopRequest() {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	vm.stopRequested = false
}

// IsResetStatsRequested returns true if resetstats() was called, then clears the flag.
func (vm *VM) IsResetStatsRequested() bool {
	val := vm.runtime.Get("_resetstats")
	if val != nil && !goja.IsUndefined(val) && val.ToBoolean() {
		vm.runtime.Set("_resetstats", false)
		return true
	}
	return false
}

// SetVariables pushes the current variable state into the JS runtime.
func (vm *VM) SetVariables(vars *Variables) {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	injectVariables(vm.runtime, vars)
}

// SyncVariables reads mutable variables back from the JS runtime.
func (vm *VM) SyncVariables(vars *Variables) {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	syncFromVM(vm.runtime, vars)
}

// GetSleepTime returns the current sleeptime value from the VM.
func (vm *VM) GetSleepTime() int {
	val := vm.runtime.Get("sleeptime")
	if val == nil || goja.IsUndefined(val) {
		return 0
	}
	return int(val.ToInteger())
}

// ResetSleepTime sets sleeptime back to 0.
func (vm *VM) ResetSleepTime() {
	vm.runtime.Set("sleeptime", 0)
}

// GetLogs returns a copy of the current log buffer.
func (vm *VM) GetLogs() []LogEntry {
	vm.logsMu.Lock()
	defer vm.logsMu.Unlock()
	out := make([]LogEntry, len(vm.logs))
	copy(out, vm.logs)
	return out
}

// ClearLogs clears the log buffer.
func (vm *VM) ClearLogs() {
	vm.logsMu.Lock()
	defer vm.logsMu.Unlock()
	vm.logs = vm.logs[:0]
}

func (vm *VM) runWithTimeout(timeout time.Duration, fn func() error) error {
	done := make(chan error, 1)
	go func() {
		done <- fn()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		// Interrupt a runaway script execution.
		vm.runtime.Interrupt("script execution timeout")
		select {
		case err := <-done:
			if err != nil {
				return fmt.Errorf("script timed out: %w", err)
			}
			return fmt.Errorf("script timed out")
		case <-time.After(200 * time.Millisecond):
			return fmt.Errorf("script timed out")
		}
	}
}
