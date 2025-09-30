package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	// Existing bindings (backend module)
	"github.com/MJE43/stake-pf-replay-go/bindings"

	// Live-ingest module (this repo, root module)
	"github.com/MJE43/stake-pf-replay-go-desktop/internal/livehttp"
)

//go:embed all:frontend/dist
var assets embed.FS

const (
	appConfigDirName    = "stake-pf-replay-go-desktop"
	legacyConfigDirName = "pf-replay"
	liveIngestDBName    = "live_ingest.db"
	docsURL             = "https://github.com/MJE43/stake-pf-replay-go/blob/main/README.md"
	repoURL             = "https://github.com/MJE43/stake-pf-replay-go"
)

var (
	appCtx   context.Context
	appCtxMu sync.RWMutex
)

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
		setAppContext(ctx)

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
		setAppContext(nil)
		log.Println("Application is closing")
		return false
	}

	if err := wails.Run(&options.App{
		Title:            "Stake PF Replay",
		Width:            1280,
		Height:           800,
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        startup,
		Menu:             buildAppMenu(),
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
		log.Printf("appdata mkdir failed: %v; using fallback", err)
		if legacy := legacyLiveDBPath(); legacy != "" {
			log.Printf("continuing to use legacy live ingest DB at %s", legacy)
			return legacy
		}
		return filepath.Join(".", liveIngestDBName)
	}

	target := filepath.Join(base, liveIngestDBName)

	if _, err := os.Stat(target); errors.Is(err, os.ErrNotExist) {
		if legacy := legacyLiveDBPath(); legacy != "" && legacy != target {
			if err := os.Rename(legacy, target); err != nil {
				log.Printf("live ingest DB migration from %s failed: %v; using legacy path", legacy, err)
				return legacy
			}
			log.Printf("migrated live ingest DB from %s to %s", legacy, target)
		}
	}

	return target
}

// appDataDir returns an OS-appropriate writable directory.
func appDataDir() string {
	if d, err := os.UserConfigDir(); err == nil && d != "" {
		return filepath.Join(d, appConfigDirName)
	}
	if h, err := os.UserHomeDir(); err == nil && h != "" {
		return filepath.Join(h, "."+appConfigDirName)
	}
	return "."
}

func legacyLiveDBPath() string {
	for _, dir := range legacyAppDataDirs() {
		if dir == "" {
			continue
		}
		candidate := filepath.Join(dir, liveIngestDBName)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	fallback := filepath.Join(".", liveIngestDBName)
	if _, err := os.Stat(fallback); err == nil {
		return fallback
	}

	return ""
}

func legacyAppDataDirs() []string {
	var dirs []string

	if d, err := os.UserConfigDir(); err == nil && d != "" {
		dirs = append(dirs, filepath.Join(d, legacyConfigDirName))
	}

	if h, err := os.UserHomeDir(); err == nil && h != "" {
		dirs = append(dirs, filepath.Join(h, "."+legacyConfigDirName))
	}

	return dirs
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

func buildAppMenu() *menu.Menu {
	rootMenu := menu.NewMenu()

	if appMenu := menu.AppMenu(); appMenu != nil {
		rootMenu.Append(appMenu)
	}

	fileMenu := menu.NewMenu()
	fileMenu.AddText("Open Data Directory", keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			openPathInExplorer(ctx, appDataDir())
		})
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			wruntime.Quit(ctx)
		})
	})
	rootMenu.Append(menu.SubMenu("File", fileMenu))

	viewMenu := menu.NewMenu()
	viewMenu.AddText("Reload Frontend", keys.CmdOrCtrl("r"), func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			wruntime.WindowReloadApp(ctx)
		})
	})
	viewMenu.AddText("Toggle Fullscreen", keys.Combo("f", keys.CmdOrCtrlKey, keys.ShiftKey), func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			toggleFullscreen(ctx)
		})
	})
	rootMenu.Append(menu.SubMenu("View", viewMenu))

	helpMenu := menu.NewMenu()
	helpMenu.AddText("Documentation", nil, func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			wruntime.BrowserOpenURL(ctx, docsURL)
		})
	})
	helpMenu.AddText("Project Repository", nil, func(_ *menu.CallbackData) {
		withAppContext(func(ctx context.Context) {
			wruntime.BrowserOpenURL(ctx, repoURL)
		})
	})
	rootMenu.Append(menu.SubMenu("Help", helpMenu))

	return rootMenu
}

func openPathInExplorer(ctx context.Context, path string) {
	if path == "" {
		return
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		log.Printf("resolve path %s failed: %v", path, err)
		abs = path
	}

	wruntime.BrowserOpenURL(ctx, fileURI(abs))
}

func fileURI(path string) string {
	clean := filepath.ToSlash(path)
	if runtime.GOOS == "windows" && len(clean) > 0 && clean[0] != '/' {
		clean = "/" + clean
	}

	u := url.URL{Scheme: "file", Path: clean}
	return u.String()
}

func toggleFullscreen(ctx context.Context) {
	if wruntime.WindowIsFullscreen(ctx) {
		wruntime.WindowUnfullscreen(ctx)
		return
	}
	wruntime.WindowFullscreen(ctx)
}

func setAppContext(ctx context.Context) {
	appCtxMu.Lock()
	defer appCtxMu.Unlock()
	appCtx = ctx
}

func withAppContext(action func(context.Context)) {
	appCtxMu.RLock()
	ctx := appCtx
	appCtxMu.RUnlock()
	if ctx == nil {
		log.Println("application context not initialised; ignoring menu action")
		return
	}
	action(ctx)
}

// Notes:
//
// * The `Bind` list now includes `liveMod`, so the frontend can call its methods directly. This matches how Wails bindings work in your repo’s current `main.go`, with minimal changes.&#x20;
// * Ensure the import path for the live module matches your root module name (`github.com/MJE43/stake-pf-replay-go-desktop`). If your module name differs, adjust the import.
