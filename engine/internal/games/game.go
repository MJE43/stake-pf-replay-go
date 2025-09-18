package games

// Seeds represents the cryptographic seeds used for game evaluation
type Seeds struct {
	Server string `json:"server"`
	Client string `json:"client"`
}

// Game represents a provably fair game that can be evaluated
type Game interface {
	// Evaluate processes a single nonce with the given seeds and parameters
	Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error)
	
	// FloatCount returns how many floats this game requires per evaluation
	FloatCount(params map[string]any) int
	
	// Spec returns metadata about this game
	Spec() GameSpec
}

// GameResult represents the outcome of a single game evaluation
type GameResult struct {
	Metric      float64 `json:"metric"`
	MetricLabel string  `json:"metric_label"`
	Details     any     `json:"details,omitempty"`
}

// GameSpec provides metadata about a game
type GameSpec struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	MetricLabel string `json:"metric_label"`
}

// GameRegistry holds all available games
var GameRegistry = make(map[string]Game)

// RegisterGame adds a game to the registry
func RegisterGame(game Game) {
	spec := game.Spec()
	GameRegistry[spec.ID] = game
}

// GetGame retrieves a game by ID
func GetGame(id string) (Game, bool) {
	game, exists := GameRegistry[id]
	return game, exists
}

// ListGames returns all registered game specs
func ListGames() []GameSpec {
	specs := make([]GameSpec, 0, len(GameRegistry))
	for _, game := range GameRegistry {
		specs = append(specs, game.Spec())
	}
	return specs
}

// init registers all games
func init() {
	RegisterGame(&LimboGame{})
	RegisterGame(&DiceGame{})
	RegisterGame(&RouletteGame{})
}