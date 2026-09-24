package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"wyvern-drive/internal/app"
	"wyvern-drive/internal/config"
	"wyvern-drive/internal/logging"
	"wyvern-drive/server/api"
)

const usage = `wyvernd — headless Wyvern Drive daemon.

Usage:
  wyvernd serve [--data-dir DIR] [--listen ADDR] [--log-level LEVEL]
  wyvernd help

Commands:
  serve   Start the daemon (binds the loopback health listener).
  help    Print this help.

Flags for serve:
  --data-dir DIR      Data directory (default: platform data dir).
  --listen ADDR       Listen address, numeric loopback only (default 127.0.0.1:9847).
  --log-level LEVEL   DEBUG, INFO, WARN or ERROR (default INFO).

Environment:
  WYVERN_DATA_DIR, WYVERN_LISTEN, WYVERN_LOG_LEVEL override the config file
  and defaults; explicit flags override everything.
`

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr, os.LookupEnv))
}

// run executes the CLI. stdout carries help/readiness output, stderr carries
// usage errors and diagnostics. The returned code is the process exit code.
func run(args []string, stdout, stderr io.Writer, lookupEnv func(string) (string, bool)) int {
	if len(args) == 0 {
		_, _ = fmt.Fprint(stdout, usage)
		return 0
	}
	switch args[0] {
	case "help", "-h", "-help", "--help":
		_, _ = fmt.Fprint(stdout, usage)
		return 0
	case "serve":
		return runServe(args[1:], stdout, stderr, lookupEnv)
	default:
		_, _ = fmt.Fprintf(stderr, "wyvernd: unknown command %q\n\n%s", args[0], usage)
		return 2
	}
}

func runServe(args []string, stdout, stderr io.Writer, lookupEnv func(string) (string, bool)) int {
	// config.Load is the single flag parser: help requests return
	// config.ErrHelp before touching any data, unknown flags and
	// positional arguments return a usage error, and everything else is a
	// configuration value failure.
	cfg, err := config.Load(args, lookupEnv)
	if err != nil {
		if errors.Is(err, config.ErrHelp) {
			_, _ = fmt.Fprint(stdout, usage)
			return 0
		}
		var usageErr *config.UsageError
		if errors.As(err, &usageErr) {
			_, _ = fmt.Fprintf(stderr, "wyvernd: %v\n\n%s", usageErr.Message, usage)
			return 2
		}
		_, _ = fmt.Fprintf(stderr, "wyvernd: %v\n", err)
		return 1
	}

	level, err := logging.ParseLevel(cfg.LogLevel)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "wyvernd: %v\n", err)
		return 1
	}
	logger, logCloser, err := logging.New(cfg.DataDir, level)
	if err != nil {
		// New already emitted a safe static stderr error.
		return 1
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// The core owns the log file from here: it closes logCloser exactly
	// once, so main defers core.Close() only. An Open failure means the
	// core never took ownership, so main still closes the log file there.
	core, err := app.Open(ctx, cfg, logger, logCloser)
	if err != nil {
		_ = logCloser.Close()
		_, _ = fmt.Fprintf(stderr, "wyvernd: cannot start: %v\n", err)
		return 1
	}
	defer func() { _ = core.Close() }()

	// The daemon serves health only, so the api handler is the server
	// Handler directly: no outer mux, no nested-mux method semantics.
	server := &http.Server{
		Addr:              cfg.ListenAddress,
		Handler:           api.NewHandler(core.Store()),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	listener, err := net.Listen("tcp", cfg.ListenAddress)
	if err != nil {
		_ = core.Close()
		_, _ = fmt.Fprintf(stderr, "wyvernd: cannot listen on %s: check that the address is free\n", cfg.ListenAddress)
		return 1
	}
	// Bind explicitly before announcing readiness: only a bound listener
	// means the daemon is actually reachable.
	_, _ = fmt.Fprintf(stdout, "HTTP server listening on %s\n", listener.Addr().String())
	logger.Info("daemon ready", "op", "serve")

	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()

	select {
	case err := <-serveErr:
		if err != nil && err != http.ErrServerClosed {
			_, _ = fmt.Fprintf(stderr, "wyvernd: server error\n")
			return 1
		}
		return 0
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		<-serveErr
		return 0
	}
}
