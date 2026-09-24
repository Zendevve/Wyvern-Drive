//go:build windows

// Command wyvern-drive is the native Wyvern Drive desktop shell.
//
// Regenerate the TypeScript bindings after every facade change (never
// hand-edit the generated output) from the repo root:
//
//	wails3 generate bindings -ts -d ./frontend/bindings ./cmd/desktop/...
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/wailsapp/wails/v3/pkg/application"

	"wyvern-drive/internal/app"
	"wyvern-drive/internal/config"
	"wyvern-drive/internal/filesystem"
	"wyvern-drive/internal/logging"
)

// productName is the single product string used for the application name,
// description, and window title.
const productName = "Wyvern Drive"

const usage = `wyvern-drive — native Wyvern Drive desktop application.

Usage:
  wyvern-drive [--data-dir DIR] [--log-level LEVEL]

Flags:
  --data-dir DIR      Data directory (default: platform data dir).
  --log-level LEVEL   DEBUG, INFO, WARN or ERROR (default INFO).

--listen is accepted for shared config compatibility but unused by the
desktop (no listener is opened), so a non-loopback value still fails
validation.

Environment:
  WYVERN_DATA_DIR, WYVERN_LOG_LEVEL override the config file
  and defaults; explicit flags override everything.
`

func main() {
	if err := run(os.Args[1:], os.LookupEnv); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "wyvern-drive: %v\n", err)
		os.Exit(1)
	}
}

// run initializes the plain Go core first, then creates the window and runs
// the native application. Deferred core.Close releases the store handle and
// then the log file before run returns on error.
//
// Closing the last window quits: application_windows.go posts a quit message
// when the last window closes unless Windows.DisableQuitOnLastWindowClosed
// is set, and that flag defaults to false, so no explicit opt-in is needed.
func run(args []string, lookupEnv func(string) (string, bool)) error {
	cfg, err := config.Load(args, lookupEnv)
	if err != nil {
		if errors.Is(err, config.ErrHelp) {
			_, _ = fmt.Fprint(os.Stdout, usage)
			return nil
		}
		var usageErr *config.UsageError
		if errors.As(err, &usageErr) {
			return fmt.Errorf("%s\n\n%s", usageErr.Message, usage)
		}
		return err
	}

	level, err := logging.ParseLevel(cfg.LogLevel)
	if err != nil {
		return err
	}
	logger, logCloser, err := logging.New(cfg.DataDir, level)
	if err != nil {
		// logging.New already emitted a safe static stderr error.
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// The core owns the log file from here: it closes logCloser exactly
	// once, so run defers core.Close() only. An Open failure means the
	// core never took ownership, so run still closes the log file there.
	core, err := app.Open(ctx, cfg, logger, logCloser)
	if err != nil {
		_ = logCloser.Close()
		return fmt.Errorf("cannot start: %w", err)
	}
	defer func() { _ = core.Close() }()

	metadata := app.NewMetadataService(filesystem.New(core.Store()))

	assetFS, err := desktopAssets()
	if err != nil {
		return err
	}
	if _, err := assetFS.Open("index.html"); err != nil {
		return fmt.Errorf("frontend assets missing index.html: run the frontend build first (%w)", err)
	}

	wailsApp := application.New(application.Options{
		Name:        productName,
		Description: productName,
		Services: []application.Service{
			// The binding runtime injects the leading context.Context, so
			// frontend callers pass no ctx argument. internal/app stays
			// Wails-free; only this composition root imports Wails.
			application.NewServiceWithOptions(metadata, application.ServiceOptions{
				MarshalError: func(err error) []byte {
					return []byte(app.MarshalError(err))
				},
			}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assetFS),
		},
	})

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  productName,
		Width:  1100,
		Height: 720,
		URL:    "/",
	})

	return wailsApp.Run()
}
