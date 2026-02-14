package scripting

import (
	"fmt"

	"github.com/dop251/goja"
)

// injectConstants sets read-only game action constants on the JS runtime.
func injectConstants(vm *goja.Runtime) {
	// HiLo action constants
	vm.Set("HILO_BET_EQUAL", 2)
	vm.Set("HILO_BET_LOW", 4)
	vm.Set("HILO_BET_HIGH", 5)
	vm.Set("HILO_SKIP", 7)
	vm.Set("HILO_CASHOUT", 3)

	// Blackjack action constants
	vm.Set("BLACKJACK_STAND", "stand")
	vm.Set("BLACKJACK_HIT", "hit")
	vm.Set("BLACKJACK_DOUBLE", "double")
	vm.Set("BLACKJACK_SPLIT", "split")
	vm.Set("BLACKJACK_INSURANCE", "insurance")
	vm.Set("BLACKJACK_NOINSURANCE", "noInsurance")
}

// injectVariables sets all bot2love global variables on the JS runtime.
// Variables are set via direct property assignment; read-only semantics
// are enforced in syncFromVM / syncToVM rather than at the JS property level,
// since goja doesn't support defineProperty getters/setters.
func injectVariables(vm *goja.Runtime, vars *Variables) {
	// Core betting variables
	vm.Set("balance", vars.Balance)
	vm.Set("nextbet", vars.NextBet)
	vm.Set("basebet", vars.BaseBet)
	vm.Set("previousbet", vars.PreviousBet)
	vm.Set("win", vars.Win)
	vm.Set("running", vars.Running)

	// Statistics aliases
	vm.Set("bets", vars.Stats.Bets)
	vm.Set("betcount", vars.Stats.Bets)
	vm.Set("wins", vars.Stats.Wins)
	vm.Set("losses", vars.Stats.Losses)
	vm.Set("winstreak", vars.Stats.WinStreak)
	vm.Set("losestreak", vars.Stats.LoseStreak)
	vm.Set("currentstreak", vars.Stats.CurrentStreak)
	vm.Set("highest_streak", []int{vars.Stats.HighestStreak})
	vm.Set("lowest_streak", []int{vars.Stats.LowestStreak})
	vm.Set("profit", vars.Stats.Profit)
	vm.Set("profit_total", vars.Stats.Profit)
	vm.Set("currentprofit", vars.Stats.CurrentProfit)
	vm.Set("current_profit", vars.Stats.CurrentProfit)
	vm.Set("wagered", vars.Stats.Wagered)
	vm.Set("highest_profit", []float64{vars.Stats.HighestProfit})
	vm.Set("lowest_profit", []float64{vars.Stats.LowestProfit})
	vm.Set("highest_bet", []float64{vars.Stats.HighestBet})
	vm.Set("started_bal", vars.Stats.StartBal)
	vm.Set("current_balance", vars.Stats.Balance)

	// Game configuration
	vm.Set("game", vars.Game)
	vm.Set("currency", vars.Currency)

	// Dice
	vm.Set("chance", vars.Chance)
	vm.Set("bethigh", vars.BetHigh)

	// Limbo
	vm.Set("target", vars.Target)
	vm.Set("target_multi", vars.Target)

	// Mines
	vm.Set("mines", vars.Mines)
	vm.Set("fields", vars.Fields)

	// Keno
	vm.Set("numbers", vars.Numbers)
	vm.Set("risk", vars.Risk)

	// Plinko
	vm.Set("rows", vars.Rows)

	// Wheel
	vm.Set("segments", vars.Segments)

	// Baccarat
	vm.Set("betamount", vars.BetAmount)
	vm.Set("player", vars.Player)
	vm.Set("banker", vars.Banker)
	vm.Set("tie", vars.Tie)

	// HiLo
	vm.Set("startcard", vars.StartCard)
	vm.Set("currentBet", vars.CurrentBet)
	vm.Set("hiloguess", vars.HiLoGuess)

	// Blackjack
	vm.Set("action", vars.Action)
	vm.Set("nextactions", vars.NextActions)

	// Other game-specific
	vm.Set("difficulty", vars.Difficulty)
	vm.Set("tiles", vars.Tiles)
	vm.Set("eggs", vars.Eggs)
	vm.Set("pumps", vars.Pumps)
	vm.Set("lines", vars.Lines)
	vm.Set("guesses", vars.Guesses)
	vm.Set("rolls", vars.Rolls)
	vm.Set("steps", vars.Steps)
	vm.Set("chips", vars.Chips)
	vm.Set("pattern", vars.Pattern)

	// Last bet result
	vm.Set("lastBet", vars.LastBet)

	// Control
	vm.Set("stoponwin", vars.StopOnWin)
	vm.Set("fastmode", vars.FastMode)
	vm.Set("sleeptime", vars.SleepTime)
	vm.Set("cashout_done", vars.CashoutDone)
}

// syncFromVM reads mutable variables back from the JS runtime into vars.
// Only variables that scripts are allowed to modify are synced.
func syncFromVM(vm *goja.Runtime, vars *Variables) {
	// Core betting (read/write)
	vars.NextBet = toFloat64(vm.Get("nextbet"))
	vars.BaseBet = toFloat64(vm.Get("basebet"))

	// Game selection (read/write)
	vars.Game = toString(vm.Get("game"))
	vars.Currency = toString(vm.Get("currency"))

	// Dice
	vars.Chance = toFloat64(vm.Get("chance"))
	vars.BetHigh = toBool(vm.Get("bethigh"))

	// Limbo
	vars.Target = toFloat64(vm.Get("target"))

	// Mines
	vars.Mines = toInt(vm.Get("mines"))
	vars.Fields = toIntSlice(vm.Get("fields"))

	// Keno
	vars.Numbers = toIntSlice(vm.Get("numbers"))
	vars.Risk = toString(vm.Get("risk"))

	// Plinko
	vars.Rows = toInt(vm.Get("rows"))

	// Wheel
	vars.Segments = toInt(vm.Get("segments"))

	// Baccarat
	vars.Player = toFloat64(vm.Get("player"))
	vars.Banker = toFloat64(vm.Get("banker"))
	vars.Tie = toFloat64(vm.Get("tie"))

	// HiLo
	vars.HiLoGuess = toNullableInt(vm.Get("hiloguess"))

	// Blackjack
	vars.Action = toString(vm.Get("action"))
	vars.NextActions = toString(vm.Get("nextactions"))

	// Other game-specific
	vars.Difficulty = toString(vm.Get("difficulty"))
	vars.Pumps = toInt(vm.Get("pumps"))
	vars.Lines = toInt(vm.Get("lines"))
	vars.Guesses = toInt(vm.Get("guesses"))
	vars.Rolls = toInt(vm.Get("rolls"))
	vars.Steps = toInt(vm.Get("steps"))

	// Control
	vars.StopOnWin = toBool(vm.Get("stoponwin"))
	vars.FastMode = toBool(vm.Get("fastmode"))
	vars.SleepTime = toInt(vm.Get("sleeptime"))

	// Pattern
	vars.Pattern = toIntSlice(vm.Get("pattern"))
}

// Variables holds the complete state of all bot2love global variables.
type Variables struct {
	// Core betting
	Balance    float64 `json:"balance"`
	NextBet    float64 `json:"nextbet"`
	BaseBet    float64 `json:"basebet"`
	PreviousBet float64 `json:"previousbet"`
	Win        bool    `json:"win"`
	Running    bool    `json:"running"`

	// Statistics (pointer, shared with engine)
	Stats *Statistics `json:"-"`

	// Game config
	Game     string `json:"game"`
	Currency string `json:"currency"`

	// Dice
	Chance  float64 `json:"chance"`
	BetHigh bool    `json:"bethigh"`

	// Limbo
	Target float64 `json:"target"`

	// Mines
	Mines  int   `json:"mines"`
	Fields []int `json:"fields"`

	// Keno
	Numbers []int  `json:"numbers"`
	Risk    string `json:"risk"`

	// Plinko
	Rows int `json:"rows"`

	// Wheel
	Segments int `json:"segments"`

	// Baccarat
	BetAmount map[string]float64 `json:"betamount"`
	Player    float64            `json:"player"`
	Banker    float64            `json:"banker"`
	Tie       float64            `json:"tie"`

	// HiLo
	StartCard  map[string]string `json:"startcard"`
	CurrentBet interface{}       `json:"currentBet"`
	HiLoGuess  *int              `json:"hiloguess"`

	// Blackjack
	Action      string `json:"action"`
	NextActions string `json:"nextactions"`

	// Other
	Difficulty string `json:"difficulty"`
	Tiles      []int  `json:"tiles"`
	Eggs       []int  `json:"eggs"`
	Pumps      int    `json:"pumps"`
	Lines      int    `json:"lines"`
	Guesses    int    `json:"guesses"`
	Rolls      int    `json:"rolls"`
	Steps      int    `json:"steps"`
	Chips      []map[string]interface{} `json:"chips"`
	Pattern    []int  `json:"pattern"`

	// Last bet
	LastBet map[string]interface{} `json:"lastBet"`

	// Control
	StopOnWin   bool `json:"stoponwin"`
	FastMode    bool `json:"fastmode"`
	SleepTime   int  `json:"sleeptime"`
	CashoutDone bool `json:"cashout_done"`
}

// NewVariables creates a Variables with sensible defaults matching bot2love.
func NewVariables(stats *Statistics) *Variables {
	return &Variables{
		Stats:      stats,
		Balance:    stats.Balance,
		Game:       "dice",
		Currency:   "trx",
		Chance:     49.5,
		BetHigh:    false,
		Target:     1.01,
		Mines:      1,
		Fields:     []int{1, 2, 3},
		Numbers:    []int{0, 1, 2, 3, 4, 5, 6, 7, 8},
		Risk:       "low",
		Rows:       8,
		Segments:   10,
		BetAmount:  map[string]float64{"player": 0, "banker": 0, "tie": 0},
		StartCard:  map[string]string{},
		Action:     "stand",
		NextActions: "BLACKJACK_STAND",
		Difficulty: "easy",
		Tiles:      []int{2},
		Eggs:       []int{0},
		Pumps:      1,
		Lines:      1,
		Guesses:    1,
		Rolls:      1,
		Steps:      1,
		Chips: []map[string]interface{}{
			{"value": "colorBlack", "amount": 0.0001},
		},
		Pattern: []int{},
		LastBet: map[string]interface{}{
			"amount":          0.0,
			"win":             false,
			"Roll":            0.0,
			"payoutMultiplier": 0.0,
			"chance":          0.0,
			"target":          0.0,
			"payout":          0.0,
			"percent":         0.0,
			"targetNumber":    0.0,
			"name":            nil,
		},
	}
}

// --- Conversion helpers ---

func toFloat64(v goja.Value) float64 {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return 0
	}
	return v.ToFloat()
}

func toInt(v goja.Value) int {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return 0
	}
	return int(v.ToInteger())
}

func toNullableInt(v goja.Value) *int {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	i := int(v.ToInteger())
	return &i
}

func toBool(v goja.Value) bool {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return false
	}
	return v.ToBoolean()
}

func toString(v goja.Value) string {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return ""
	}
	return v.String()
}

func toIntSlice(v goja.Value) []int {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	obj := v.ToObject(nil)
	if obj == nil {
		return nil
	}
	lengthVal := obj.Get("length")
	if lengthVal == nil || goja.IsUndefined(lengthVal) {
		return nil
	}
	length := int(lengthVal.ToInteger())
	result := make([]int, length)
	for i := 0; i < length; i++ {
		val := obj.Get(fmt.Sprintf("%d", i))
		if val != nil && !goja.IsUndefined(val) {
			result[i] = int(val.ToInteger())
		}
	}
	return result
}
