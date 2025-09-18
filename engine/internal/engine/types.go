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

// Game interface moved to games package to avoid duplication
