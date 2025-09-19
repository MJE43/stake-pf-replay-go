package main

import (
"github.com/wailsapp/wails/v2"
"github.com/wailsapp/wails/v2/pkg/options"

// Bindings live INSIDE the backend module so they can import backend/internal/...
"github.com/MJE43/stake-pf-replay-go/bindings"
)

func main() {
app := bindings.New()

if err := wails.Run(&options.App{
Title:     "Stake PF Replay",
Width:     1280,
Height:    800,
OnStartup: app.Startup,          // sets DB path & runs migrations
Bind:      []interface{}{app},   // exposes methods to the frontend
}); err != nil {
panic(err)
}
}