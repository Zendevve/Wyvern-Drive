// Package app is the single application core shared by the headless daemon
// (cmd/wyvernd) and the future desktop shell (cmd/desktop).
//
// Open provisions the config, database, logs, cache and backups areas
// beneath the data directory, then takes ownership of the supplied logger
// and log closer. Close releases the owned resources exactly once, in an
// order future stores can extend: T2's database handle must close before
// the log file flushes, so Close always releases the store first and the
// log closer last. There is no global mutable singleton: every operation
// takes a context and each Open returns an independent instance. T2 wires
// SQLite, migrations, readiness and the health handler into this same core;
// this ticket provisions the directory skeleton and the open-once/close-once
// lifecycle so the daemon starts.
package app

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"wyvern-drive/internal/config"
)

// areas are the data-directory subdirectories owned by the core. No secrets
// exist in this milestone.
var areas = []string{"config", "database", "logs", "cache", "backups"}

// App is the shared application core. Use Open to construct it; the zero
// value is not usable.
type App struct {
	cfg    config.Config
	logger *slog.Logger

	mu sync.Mutex
	// logCloser releases the owned log file. Close order matters once T2
	// adds a store: the database handle closes first, then logCloser, so
	// shutdown diagnostics still have somewhere to go.
	logCloser io.Closer
	closed    bool
}

// Open provisions the data-directory areas and takes ownership of logger
// and logCloser. The core closes logCloser on the first Close; later Close
// calls are no-ops returning nil.
//
// Open fails without side effects visible to callers when ctx is already
// cancelled or logger is nil. Area creation is MkdirAll only — no file
// handles are held — so partial provisioning needs no release step: a later
// retry on the same directory recovers idempotently.
func Open(ctx context.Context, cfg config.Config, logger *slog.Logger, logCloser io.Closer) (*App, error) {
	if logger == nil {
		return nil, fmt.Errorf("app: nil logger")
	}
	if logCloser == nil {
		return nil, fmt.Errorf("app: nil log closer")
	}
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("app: open cancelled: %v", err)
	}
	for _, area := range areas {
		if err := os.MkdirAll(filepath.Join(cfg.DataDir, area), 0o700); err != nil {
			return nil, fmt.Errorf("app: cannot create %s directory: %v", area, err)
		}
	}
	return &App{cfg: cfg, logger: logger, logCloser: logCloser}, nil
}

// Close releases owned resources exactly once: the first call closes the
// future store handle, then the log file, and records the closed state;
// later calls return nil without touching either.
func (a *App) Close() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return nil
	}
	a.closed = true
	// T2 adds: close the store here, before the log file below.
	return a.logCloser.Close()
}

// Config returns the resolved configuration the core was opened with.
func (a *App) Config() config.Config { return a.cfg }

// Logger returns the owned logger.
func (a *App) Logger() *slog.Logger { return a.logger }
