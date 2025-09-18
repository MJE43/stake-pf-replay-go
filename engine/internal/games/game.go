package games

// Game represents a provably fair game that can be evaluated
type Game interface {
	// Evaluate processes the floats and returns a metric and optional details
	Evaluate(floats []float64) (metric float64, details interface{})
	
	// FloatsNeeded returns how many floats this game requires per evaluation
	FloatsNeeded() int
	
	// MetricName returns the name of the metric this game produces
	MetricName() string
	
	// Name returns the game's identifier
	Name() string
}

// GameResult represents the outcome of a single game evaluation
type GameResult struct {
	Nonce   uint64      `json:"nonce"`
	Metric  float64     `json:"metric"`
	Details interface{} `json:"details,omitempty"`
}

// GameRegistry holds all available games
var GameRegistry = make(map[string]Game)

// RegisterGame adds a game to the registry
func RegisterGame(game Game) {
	GameRegistry[game.Name()] = game
}

// GetGame retrieves a game by name
func GetGame(name string) (Game, bool) {
	game, exists := GameRegistry[name]
	return game, exists
}

// ListGames returns all registered game names
func ListGames() []string {
	names := make([]string, 0, len(GameRegistry))
	for name := range GameRegistry {
		names = append(names, name)
	}
	return names
}

// init registers all games
func init() {
	RegisterGame(&LimboGame{})
	RegisterGame(&DiceGame{})
	RegisterGame(&RouletteGame{})
}