package bindings

import (
	"context"
	"os"
	"path/filepath"

	"github.com/MJE43/stake-pf-replay-go/internal/store"
)

type App struct {
	ctx context.Context
	db  store.DB
}

func New() *App { return &App{} }

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}

	appDir := filepath.Join(configDir, "stake-pf-replay-go-desktop")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		panic(err)
	}

	dbPath := filepath.Join(appDir, "pf-replay.db")
	db, err := store.NewSQLiteDB(dbPath)
	if err != nil {
		panic(err)
	}
	a.db = db

	if err := a.db.Migrate(); err != nil {
		panic(err)
	}
}
