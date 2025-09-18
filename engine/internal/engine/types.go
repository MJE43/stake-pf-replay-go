package engine

import "encoding/json"

type Seeds struct {
    Server string // ASCII; do NOT hex-decode
    Client string
}

type Metric = float64

type GameResult struct {
    Metric      Metric           `json:"metric"`
    MetricLabel string           `json:"metric_label"`
    Details     json.RawMessage  `json:"details,omitempty"`
}

type GameSpec struct {
    ID          string `json:"id"`
    MetricLabel string `json:"metric_label"`
    // Optional: JSON schema for params if you want UI auto-gen later
}

type Game interface {
    Spec() GameSpec
    // Count of floats needed for deterministic evaluation given params
    FloatCount(params map[string]any) int
    Evaluate(seeds Seeds, nonce uint64, params map[string]any) (GameResult, error)
}
