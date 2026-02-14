package stake

import (
	"context"
	"encoding/json"
	"fmt"
)

var allowedDiceConditions = map[string]bool{
	"above": true,
	"below": true,
}

var allowedKenoRisks = map[string]bool{
	"low":     true,
	"medium":  true,
	"high":    true,
	"classic": true,
}

var allowedHiLoGuesses = map[string]bool{
	"lower":       true,
	"higher":      true,
	"equal":       true,
	"lowerEqual":  true,
	"higherEqual": true,
	"skip":        true,
}

var allowedBlackjackActions = map[string]bool{
	"hit":         true,
	"stand":       true,
	"double":      true,
	"split":       true,
	"insurance":   true,
	"noInsurance": true,
}

var allowedActiveBetGames = map[string]bool{
	"hilo":      true,
	"mines":     true,
	"blackjack": true,
}

var allowedCardRanks = map[string]bool{
	"A": true, "2": true, "3": true, "4": true, "5": true, "6": true, "7": true,
	"8": true, "9": true, "10": true, "J": true, "Q": true, "K": true,
}

var allowedCardSuits = map[string]bool{
	"C": true,
	"D": true,
	"H": true,
	"S": true,
}

// --- Dice ---

// DiceBetRequest contains the parameters for a dice bet.
type DiceBetRequest struct {
	Target    float64 `json:"target"`
	Condition string  `json:"condition"` // "above" or "below"
	Amount    float64 `json:"amount"`
}

// DiceBetResult contains the outcome of a dice bet.
type DiceBetResult struct {
	BetResult
	State struct {
		Result float64 `json:"result"`
		Target float64 `json:"target"`
	} `json:"state"`
}

// DiceBet places a dice bet with the given parameters.
// target: the roll target (0.00-100.00)
// condition: "above" or "below"
// amount: bet amount in the client's configured currency
func (c *Client) DiceBet(ctx context.Context, req DiceBetRequest) (*DiceBetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: dice amount must be > 0, got %f", req.Amount)
	}
	if req.Target < 0 || req.Target > 100 {
		return nil, fmt.Errorf("stake: dice target must be between 0 and 100, got %f", req.Target)
	}
	if !allowedDiceConditions[req.Condition] {
		return nil, fmt.Errorf("stake: invalid dice condition %q", req.Condition)
	}

	body := map[string]any{
		"target":     req.Target,
		"condition":  req.Condition,
		"identifier": BetIdentifier(),
		"amount":     req.Amount,
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/dice/roll", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "diceRoll")
	if err != nil {
		return nil, err
	}

	var result DiceBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse dice result: %w", err)
	}

	return &result, nil
}

// --- Limbo ---

// LimboBetRequest contains the parameters for a limbo bet.
type LimboBetRequest struct {
	MultiplierTarget float64 `json:"multiplierTarget"`
	Amount           float64 `json:"amount"`
}

// LimboBetResult contains the outcome of a limbo bet.
type LimboBetResult struct {
	BetResult
	State struct {
		Result float64 `json:"result"` // The crash multiplier
	} `json:"state"`
}

// LimboBet places a limbo bet targeting a specific multiplier.
func (c *Client) LimboBet(ctx context.Context, req LimboBetRequest) (*LimboBetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: limbo amount must be > 0, got %f", req.Amount)
	}
	if req.MultiplierTarget <= 0 {
		return nil, fmt.Errorf("stake: limbo multiplierTarget must be > 0, got %f", req.MultiplierTarget)
	}

	body := map[string]any{
		"multiplierTarget": req.MultiplierTarget,
		"identifier":       BetIdentifier(),
		"amount":           req.Amount,
		"currency":         c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/limbo/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "limboBet")
	if err != nil {
		return nil, err
	}

	var result LimboBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse limbo result: %w", err)
	}

	return &result, nil
}

// --- Keno ---

// KenoBetRequest contains the parameters for a keno bet.
type KenoBetRequest struct {
	Numbers []int   `json:"numbers"` // Selected numbers (1-40)
	Risk    string  `json:"risk"`    // "low", "medium", "high", "classic"
	Amount  float64 `json:"amount"`
}

// KenoBet places a keno bet.
func (c *Client) KenoBet(ctx context.Context, req KenoBetRequest) (*BetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: keno amount must be > 0, got %f", req.Amount)
	}
	if !allowedKenoRisks[req.Risk] {
		return nil, fmt.Errorf("stake: invalid keno risk %q", req.Risk)
	}
	if len(req.Numbers) < 1 || len(req.Numbers) > 10 {
		return nil, fmt.Errorf("stake: keno numbers must contain 1-10 values, got %d", len(req.Numbers))
	}
	seen := make(map[int]bool, len(req.Numbers))
	for _, n := range req.Numbers {
		if n < 0 || n > 39 {
			return nil, fmt.Errorf("stake: keno number out of range [0,39]: %d", n)
		}
		if seen[n] {
			return nil, fmt.Errorf("stake: duplicate keno number: %d", n)
		}
		seen[n] = true
	}

	body := map[string]any{
		"numbers":    req.Numbers,
		"risk":       req.Risk,
		"identifier": BetIdentifier(),
		"amount":     req.Amount,
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/keno/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "kenoBet")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse keno result: %w", err)
	}

	return &result, nil
}

// --- Baccarat ---

// BaccaratBetRequest contains the parameters for a baccarat bet.
type BaccaratBetRequest struct {
	Tie    float64 `json:"tie"`    // Bet on tie
	Player float64 `json:"player"` // Bet on player
	Banker float64 `json:"banker"` // Bet on banker
}

// BaccaratBet places a baccarat bet.
func (c *Client) BaccaratBet(ctx context.Context, req BaccaratBetRequest) (*BetResult, error) {
	if req.Tie < 0 || req.Player < 0 || req.Banker < 0 {
		return nil, fmt.Errorf("stake: baccarat bet amounts cannot be negative")
	}
	if (req.Tie + req.Player + req.Banker) <= 0 {
		return nil, fmt.Errorf("stake: baccarat total bet must be > 0")
	}

	body := map[string]any{
		"tie":        req.Tie,
		"player":     req.Player,
		"banker":     req.Banker,
		"identifier": BetIdentifier(),
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/baccarat/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "baccaratBet")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse baccarat result: %w", err)
	}

	return &result, nil
}

// --- HiLo (multi-round) ---

// HiLoBetRequest contains the parameters for starting a HiLo game.
type HiLoBetRequest struct {
	Amount    float64 `json:"amount"`
	StartCard *Card   `json:"startCard,omitempty"` // Optional starting card
}

// HiLoBet starts a new HiLo game.
func (c *Client) HiLoBet(ctx context.Context, req HiLoBetRequest) (*BetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: hilo amount must be > 0, got %f", req.Amount)
	}
	if req.StartCard != nil {
		if !allowedCardRanks[req.StartCard.Rank] {
			return nil, fmt.Errorf("stake: invalid hilo startCard rank %q", req.StartCard.Rank)
		}
		if !allowedCardSuits[req.StartCard.Suit] {
			return nil, fmt.Errorf("stake: invalid hilo startCard suit %q (expected one of C,D,H,S)", req.StartCard.Suit)
		}
	}

	body := map[string]any{
		"identifier": BetIdentifier(),
		"currency":   c.Currency(),
		"amount":     req.Amount,
	}
	if req.StartCard != nil {
		body["startCard"] = req.StartCard
	}

	resp, err := c.gameRequest(ctx, "_api/casino/hilo/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "hiloBet")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse hilo bet result: %w", err)
	}

	return &result, nil
}

// HiLoNext draws the next card with a guess.
// guess: "higher", "lower", "equal", "higherEqual", "lowerEqual", "skip"
func (c *Client) HiLoNext(ctx context.Context, guess string) (*BetResult, error) {
	if !allowedHiLoGuesses[guess] {
		return nil, fmt.Errorf("stake: invalid hilo guess %q", guess)
	}

	body := map[string]any{
		"guess": guess,
	}

	resp, err := c.gameRequest(ctx, "_api/casino/hilo/next", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "hiloNext")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse hilo next result: %w", err)
	}

	return &result, nil
}

// HiLoCashout cashes out the current HiLo game.
func (c *Client) HiLoCashout(ctx context.Context) (*BetResult, error) {
	body := map[string]any{
		"identifier": BetIdentifier(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/hilo/cashout", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "hiloCashout")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse hilo cashout result: %w", err)
	}

	return &result, nil
}

// --- Mines (multi-round) ---

// MinesBetRequest contains the parameters for starting a Mines game.
type MinesBetRequest struct {
	Amount     float64 `json:"amount"`
	MinesCount int     `json:"minesCount"`
	Fields     []int   `json:"fields"` // Initial fields to reveal (0-24)
}

// MinesBet starts a new Mines game.
func (c *Client) MinesBet(ctx context.Context, req MinesBetRequest) (*BetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: mines amount must be > 0, got %f", req.Amount)
	}
	if req.MinesCount < 1 || req.MinesCount > 24 {
		return nil, fmt.Errorf("stake: minesCount must be between 1 and 24, got %d", req.MinesCount)
	}
	seen := make(map[int]bool, len(req.Fields))
	for _, f := range req.Fields {
		if f < 0 || f > 24 {
			return nil, fmt.Errorf("stake: mines field out of range [0,24]: %d", f)
		}
		if seen[f] {
			return nil, fmt.Errorf("stake: duplicate mines field: %d", f)
		}
		seen[f] = true
	}

	body := map[string]any{
		"amount":     req.Amount,
		"currency":   c.Currency(),
		"identifier": BetIdentifier(),
		"minesCount": req.MinesCount,
	}
	if len(req.Fields) > 0 {
		// When starting a game without pre-selections, omit fields entirely (not null).
		body["fields"] = req.Fields
	}

	resp, err := c.gameRequest(ctx, "_api/casino/mines/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "minesBet")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse mines bet result: %w", err)
	}

	return &result, nil
}

// MinesNext reveals a tile in the current Mines game.
func (c *Client) MinesNext(ctx context.Context, field int) (*BetResult, error) {
	if field < 0 || field > 24 {
		return nil, fmt.Errorf("stake: mines next field out of range [0,24]: %d", field)
	}

	body := map[string]any{
		"fields": []int{field},
	}

	resp, err := c.gameRequest(ctx, "_api/casino/mines/next", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "minesNext")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse mines next result: %w", err)
	}

	return &result, nil
}

// MinesCashout cashes out the current Mines game.
func (c *Client) MinesCashout(ctx context.Context) (*BetResult, error) {
	body := map[string]any{
		"identifier": BetIdentifier(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/mines/cashout", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "minesCashout")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse mines cashout result: %w", err)
	}

	return &result, nil
}

// --- Blackjack (multi-round) ---

// BlackjackBetRequest contains the parameters for starting a Blackjack game.
type BlackjackBetRequest struct {
	Amount float64 `json:"amount"`
}

// BlackjackBet starts a new Blackjack game.
func (c *Client) BlackjackBet(ctx context.Context, req BlackjackBetRequest) (*BetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: blackjack amount must be > 0, got %f", req.Amount)
	}

	body := map[string]any{
		"identifier": BetIdentifier(),
		"currency":   c.Currency(),
		"amount":     req.Amount,
	}

	resp, err := c.gameRequest(ctx, "_api/casino/blackjack/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "blackjackBet")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse blackjack bet result: %w", err)
	}

	return &result, nil
}

// BlackjackNext performs the next action in a Blackjack game.
// action: "hit", "stand", "double", "split", "insurance", "noInsurance"
func (c *Client) BlackjackNext(ctx context.Context, action string) (*BetResult, error) {
	if !allowedBlackjackActions[action] {
		return nil, fmt.Errorf("stake: invalid blackjack action %q", action)
	}

	body := map[string]any{
		"action":     action,
		"identifier": BetIdentifier(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/blackjack/next", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "blackjackNext")
	if err != nil {
		return nil, err
	}

	var result BetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse blackjack next result: %w", err)
	}

	return &result, nil
}

// --- Plinko ---

// PlinkoBetRequest contains the parameters for a plinko bet.
type PlinkoBetRequest struct {
	Risk   string  `json:"risk"`   // "low", "medium", "high"
	Rows   int     `json:"rows"`   // 8, 12, or 16
	Amount float64 `json:"amount"`
}

var allowedPlinkoRisks = map[string]bool{
	"low":    true,
	"medium": true,
	"high":   true,
}

var allowedPlinkoRows = map[int]bool{
	8: true, 12: true, 16: true,
}

// PlinkoBetResult contains the outcome of a plinko bet.
type PlinkoBetResult struct {
	BetResult
	State struct {
		Result float64 `json:"result"`
	} `json:"state"`
}

// PlinkoBet places a plinko bet.
func (c *Client) PlinkoBet(ctx context.Context, req PlinkoBetRequest) (*PlinkoBetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: plinko amount must be > 0, got %f", req.Amount)
	}
	if !allowedPlinkoRisks[req.Risk] {
		return nil, fmt.Errorf("stake: invalid plinko risk %q", req.Risk)
	}
	if !allowedPlinkoRows[req.Rows] {
		return nil, fmt.Errorf("stake: invalid plinko rows %d (expected 8, 12, or 16)", req.Rows)
	}

	body := map[string]any{
		"risk":       req.Risk,
		"rows":       req.Rows,
		"identifier": BetIdentifier(),
		"amount":     req.Amount,
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/plinko/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "plinkoBet")
	if err != nil {
		return nil, err
	}

	var result PlinkoBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse plinko result: %w", err)
	}

	return &result, nil
}

// --- Wheel ---

// WheelBetRequest contains the parameters for a wheel bet.
type WheelBetRequest struct {
	Risk     string  `json:"risk"`     // "low", "medium", "high"
	Segments int     `json:"segments"` // 10, 20, 30, 40, or 50
	Amount   float64 `json:"amount"`
}

var allowedWheelRisks = map[string]bool{
	"low":    true,
	"medium": true,
	"high":   true,
}

var allowedWheelSegments = map[int]bool{
	10: true, 20: true, 30: true, 40: true, 50: true,
}

// WheelBetResult contains the outcome of a wheel bet.
type WheelBetResult struct {
	BetResult
	State struct {
		Result float64 `json:"result"`
	} `json:"state"`
}

// WheelBet places a wheel bet.
func (c *Client) WheelBet(ctx context.Context, req WheelBetRequest) (*WheelBetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: wheel amount must be > 0, got %f", req.Amount)
	}
	if !allowedWheelRisks[req.Risk] {
		return nil, fmt.Errorf("stake: invalid wheel risk %q", req.Risk)
	}
	if !allowedWheelSegments[req.Segments] {
		return nil, fmt.Errorf("stake: invalid wheel segments %d", req.Segments)
	}

	body := map[string]any{
		"risk":       req.Risk,
		"segments":   req.Segments,
		"identifier": BetIdentifier(),
		"amount":     req.Amount,
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/wheel/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "wheelBet")
	if err != nil {
		return nil, err
	}

	var result WheelBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse wheel result: %w", err)
	}

	return &result, nil
}

// --- Roulette ---

// RouletteChip represents a single chip placement on the roulette table.
type RouletteChip struct {
	Value float64 `json:"value"` // Chip value
	Index int     `json:"index"` // Table position index
}

// RouletteBetRequest contains the parameters for a roulette bet.
type RouletteBetRequest struct {
	Chips  []RouletteChip `json:"chips"`
	Amount float64        `json:"amount"` // Total amount
}

// RouletteBetResult contains the outcome of a roulette bet.
type RouletteBetResult struct {
	BetResult
	State struct {
		Result int `json:"result"` // The winning number (0-36)
	} `json:"state"`
}

// RouletteBet places a roulette bet.
func (c *Client) RouletteBet(ctx context.Context, req RouletteBetRequest) (*RouletteBetResult, error) {
	if len(req.Chips) == 0 {
		return nil, fmt.Errorf("stake: roulette chips must not be empty")
	}
	totalValue := 0.0
	for _, chip := range req.Chips {
		if chip.Value <= 0 {
			return nil, fmt.Errorf("stake: roulette chip value must be > 0, got %f", chip.Value)
		}
		totalValue += chip.Value
	}
	if totalValue <= 0 {
		return nil, fmt.Errorf("stake: roulette total chip value must be > 0")
	}

	// Convert chips to API format
	chipMaps := make([]map[string]any, len(req.Chips))
	for i, chip := range req.Chips {
		chipMaps[i] = map[string]any{
			"value": chip.Value,
			"index": chip.Index,
		}
	}

	body := map[string]any{
		"chips":      chipMaps,
		"identifier": BetIdentifier(),
		"currency":   c.Currency(),
	}

	resp, err := c.gameRequest(ctx, "_api/casino/roulette/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "rouletteBet")
	if err != nil {
		return nil, err
	}

	var result RouletteBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse roulette result: %w", err)
	}

	return &result, nil
}

// --- Video Poker ---

// VideoPokerBetRequest contains the parameters for a video poker bet.
type VideoPokerBetRequest struct {
	Amount float64 `json:"amount"`
}

// VideoPokerHeldRequest contains which cards to hold for the draw.
type VideoPokerHeldRequest struct {
	Held []bool `json:"held"` // 5-element array of hold decisions
}

// VideoPokerBetResult contains the outcome of a video poker bet.
type VideoPokerBetResult struct {
	BetResult
	State struct {
		Cards []Card `json:"cards"` // Current hand
	} `json:"state"`
}

// VideoPokerBet starts a new video poker game by dealing the initial hand.
func (c *Client) VideoPokerBet(ctx context.Context, req VideoPokerBetRequest) (*VideoPokerBetResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("stake: video poker amount must be > 0, got %f", req.Amount)
	}

	body := map[string]any{
		"identifier": BetIdentifier(),
		"currency":   c.Currency(),
		"amount":     req.Amount,
	}

	resp, err := c.gameRequest(ctx, "_api/casino/videopoker/bet", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "videoPokerBet")
	if err != nil {
		return nil, err
	}

	var result VideoPokerBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse video poker bet result: %w", err)
	}

	return &result, nil
}

// VideoPokerDraw performs the draw phase with the held cards.
func (c *Client) VideoPokerDraw(ctx context.Context, req VideoPokerHeldRequest) (*VideoPokerBetResult, error) {
	if len(req.Held) != 5 {
		return nil, fmt.Errorf("stake: video poker held must have exactly 5 elements, got %d", len(req.Held))
	}

	body := map[string]any{
		"held": req.Held,
	}

	resp, err := c.gameRequest(ctx, "_api/casino/videopoker/draw", body)
	if err != nil {
		return nil, err
	}

	gameData, err := extractGameData(resp, "videoPokerDraw")
	if err != nil {
		return nil, err
	}

	var result VideoPokerBetResult
	if err := json.Unmarshal(gameData, &result); err != nil {
		return nil, fmt.Errorf("stake: parse video poker draw result: %w", err)
	}

	return &result, nil
}

// --- Active bet recovery ---

// GetActiveBet fetches the active bet for a multi-round game.
// game: "hilo", "mines", "blackjack"
// Returns nil BetResult if no active bet exists.
func (c *Client) GetActiveBet(ctx context.Context, game string) (*BetResult, error) {
	if !allowedActiveBetGames[game] {
		return nil, fmt.Errorf("stake: invalid active-bet game %q (expected one of hilo|mines|blackjack)", game)
	}

	path := fmt.Sprintf("_api/casino/active-bet/%s", game)

	resp, err := c.gameRequest(ctx, path, map[string]any{})
	if err != nil {
		return nil, err
	}
	if resp.HasError() {
		return nil, resp.FirstError()
	}

	// Parse the response to check if there's an active bet
	var data struct {
		User struct {
			ActiveCasinoBet *BetResult `json:"activeCasinoBet"`
		} `json:"user"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, fmt.Errorf("stake: parse active bet: %w", err)
	}

	return data.User.ActiveCasinoBet, nil
}
