package main

import (
	"context"
	"embed"
	"fmt"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	// Bindings live INSIDE the backend module so they can import backend/internal/...
	"github.com/MJE43/stake-pf-replay-go/bindings"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Add logging to see what's happening
	log.Println("Starting Stake PF Replay application...")
	
	app := bindings.New()

	log.Println("Creating Wails application...")
	if err := wails.Run(&options.App{
		Title:            "Stake PF Replay",
		Width:            1280,
		Height:           800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:        app.Startup,
		Bind:             []interface{}{app},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnDomReady: func(ctx context.Context) {
			log.Println("DOM is ready")
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			log.Println("Application is closing")
			return false
		},
	}); err != nil {
		log.Printf("Error running Wails app: %v", err)
		fmt.Printf("Error: %v\n", err)
		panic(err)
	}
	
	log.Println("Application exited normally")
}