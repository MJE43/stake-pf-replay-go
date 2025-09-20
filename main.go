package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	// Existing bindings (backend module)
	"github.com/MJE43/stake-pf-replay-go/bindings"

	// Live-ingest module (this repo, root module)
	"github.com/MJE43/stake-pf-replay-go-desktop/internal/livehttp"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	log.Printf("Starting Stake PF Replay (Go %s)...", runtime.Version())

	// Existing backend bindings object
	app := bindings.New()

	// Live ingest module wiring
	dbPath := defaultLiveDBPath()
	port := envInt("LIVE_INGEST_PORT", 17888)
	token := os.Getenv("LIVE_INGEST_TOKEN") // optional; when empty, no auth
	liveMod, err := livehttp.NewLiveModule(dbPath, port, token)
	if err != nil {
		log.Fatalf("live module init failed: %v", err)
	}

	startup := func(ctx context.Context) {
		// Start existing app
		app.Startup(ctx)

		// Start local HTTP ingest server
		if err := liveMod.Startup(ctx); err != nil {
			log.Printf("live ingest server failed to start: %v", err)
		} else {
			info := liveMod.IngestInfo()
			log.Printf("Live ingest ready at %s (token enabled: %v)", info.URL, info.TokenEnabled)
		}
	}

	beforeClose := func(ctx context.Context) (prevent bool) {
		// Graceful shutdown of live module
		if err := liveMod.Shutdown(ctx); err != nil {
			log.Printf("live module shutdown error: %v", err)
		}
		log.Println("Application is closing")
		return false
	}

	if err := wails.Run(&options.App{
		Title:            "Stake PF Replay",
		Width:            1280,
		Height:           800,
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        startup,
		Bind:             []interface{}{app, liveMod},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnDomReady: func(ctx context.Context) {
			log.Println("DOM is ready")
		},
		OnBeforeClose: beforeClose,
	}); err != nil {
		log.Printf("Error running Wails app: %v", err)
		fmt.Printf("Error: %v\n", err)
		panic(err)
	}

	log.Println("Application exited normally")
}

func defaultLiveDBPath() string {
	base := appDataDir()
	if err := os.MkdirAll(base, 0o755); err != nil {
		// Fallback to current dir
		log.Printf("appdata mkdir failed: %v; using working directory", err)
		return "./live_ingest.db"
	}
	return filepath.Join(base, "live_ingest.db")
}

// appDataDir returns an OS-appropriate writable directory.
func appDataDir() string {
	// Prefer OS config dir (roams per platform)
	if d, err := os.UserConfigDir(); err == nil && d != "" {
		return filepath.Join(d, "pf-replay")
	}
	// Fallback to home
	if h, err := os.UserHomeDir(); err == nil && h != "" {
		return filepath.Join(h, ".pf-replay")
	}
	// Last resort: current working directory
	return "."
}

func envInt(k string, def int) int {
	if s := os.Getenv(k); s != "" {
		var v int
		if _, err := fmt.Sscanf(s, "%d", &v); err == nil {
			return v
		}
	}
	return def
}



// Notes:
//
// * The `Bind` list now includes `liveMod`, so the frontend can call its methods directly. This matches how Wails bindings work in your repo’s current `main.go`, with minimal changes.&#x20;
// * Ensure the import path for the live module matches your root module name (`github.com/MJE43/stake-pf-replay-go-desktop`). If your module name differs, adjust the import.
