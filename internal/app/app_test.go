package app

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"

	"wyvern-drive/internal/config"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// testCloser is a spy io.Closer recording how many times Close ran.
type testCloser struct {
	mu    sync.Mutex
	calls int
	err   error
}

func (c *testCloser) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls++
	return c.err
}

func (c *testCloser) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}

func testConfig(dataDir string) config.Config {
	return config.Config{DataDir: dataDir, ListenAddress: "127.0.0.1:9847", LogLevel: "INFO"}
}

func open(t *testing.T, ctx context.Context, dataDir string, closer io.Closer) *App {
	t.Helper()
	a, err := Open(ctx, testConfig(dataDir), testLogger(), closer)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func areaNames() []string { return []string{"config", "database", "logs", "cache", "backups"} }

// Open provisions the five data areas beneath a fresh temp data directory.
func TestOpenCreatesDataAreas(t *testing.T) {
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	a := open(t, context.Background(), dataDir, &testCloser{})
	defer func() {
		if err := a.Close(); err != nil {
			t.Fatal(err)
		}
	}()
	for _, area := range areaNames() {
		info, err := os.Stat(filepath.Join(dataDir, area))
		if err != nil {
			t.Fatalf("area %q missing: %v", area, err)
		}
		if !info.IsDir() {
			t.Fatalf("area %q is not a directory", area)
		}
	}
	if got := a.Config().DataDir; got != dataDir {
		t.Fatalf("Config().DataDir = %q, want %q", got, dataDir)
	}
	if a.Logger() == nil {
		t.Fatal("Logger() must not be nil")
	}
}

// Opening an already-provisioned directory is idempotent.
func TestOpenExistingDirs(t *testing.T) {
	dataDir := t.TempDir()
	ctx := context.Background()
	first := open(t, ctx, dataDir, &testCloser{})
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	second := open(t, ctx, dataDir, &testCloser{})
	if err := second.Close(); err != nil {
		t.Fatal(err)
	}
}

// Close closes the owned log file exactly once: repeat calls are no-ops
// that never touch the closer again.
func TestCloseIsIdempotent(t *testing.T) {
	closer := &testCloser{}
	a := open(t, context.Background(), t.TempDir(), closer)
	if err := a.Close(); err != nil {
		t.Fatal(err)
	}
	if err := a.Close(); err != nil {
		t.Fatalf("second Close must be a no-op, got: %v", err)
	}
	if got := closer.count(); got != 1 {
		t.Fatalf("log closer ran %d times, want exactly 1", got)
	}
}

// Close propagates a log-file close failure to the caller.
func TestClosePropagatesLogCloseError(t *testing.T) {
	want := errors.New("disk full")
	a := open(t, context.Background(), t.TempDir(), &testCloser{err: want})
	if err := a.Close(); err != want {
		t.Fatalf("Close = %v, want %v", err, want)
	}
	if err := a.Close(); err != nil {
		t.Fatalf("second Close after failure must be a no-op, got: %v", err)
	}
}

// A nil logger fails startup instead of building a core that cannot log.
func TestOpenRequiresLogger(t *testing.T) {
	if _, err := Open(context.Background(), testConfig(t.TempDir()), nil, &testCloser{}); err == nil {
		t.Fatal("expected error for nil logger, got nil")
	}
}

// A nil log closer fails startup: the core can never own what it cannot close.
func TestOpenRequiresLogCloser(t *testing.T) {
	if _, err := Open(context.Background(), testConfig(t.TempDir()), testLogger(), nil); err == nil {
		t.Fatal("expected error for nil log closer, got nil")
	}
}

// A cancelled context fails startup before any work begins.
func TestOpenCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Open(ctx, testConfig(t.TempDir()), testLogger(), &testCloser{}); err == nil {
		t.Fatal("expected error for cancelled context, got nil")
	}
}

// No global mutable singleton: two cores on different data directories are
// independent, and closing one leaves the other usable.
func TestOpenNoGlobalSingleton(t *testing.T) {
	ctx := context.Background()
	closerA, closerB := &testCloser{}, &testCloser{}
	a := open(t, ctx, t.TempDir(), closerA)
	b := open(t, ctx, t.TempDir(), closerB)
	if a == b {
		t.Fatal("Open returned the same instance twice: global singleton")
	}
	if err := a.Close(); err != nil {
		t.Fatal(err)
	}
	if got := closerA.count(); got != 1 {
		t.Fatalf("closer A ran %d times, want 1", got)
	}
	if got := closerB.count(); got != 0 {
		t.Fatalf("closing A closed B's log file: closer B ran %d times", got)
	}
	if err := b.Close(); err != nil {
		t.Fatal(err)
	}
	if err := a.Close(); err != nil {
		t.Fatalf("Close after sibling close must stay a no-op, got: %v", err)
	}
}

func TestOpenDirMode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX directory modes do not enforce Windows ACLs; the data directory inherits user ACLs")
	}
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	a := open(t, context.Background(), dataDir, &testCloser{})
	defer func() { _ = a.Close() }()
	for _, area := range areaNames() {
		info, err := os.Stat(filepath.Join(dataDir, area))
		if err != nil {
			t.Fatal(err)
		}
		if perm := info.Mode().Perm(); perm != 0o700 {
			t.Fatalf("area %q mode = %o, want 700", area, perm)
		}
	}
}

// Open migrates the database to the production version and reports
// readiness at that version; the settings table from the foundation
// migration exists.
func TestOpenMigratesDatabase(t *testing.T) {
	ctx := context.Background()
	dataDir := filepath.Join(t.TempDir(), "wyvern-data")
	a := open(t, ctx, dataDir, &testCloser{})
	defer func() { _ = a.Close() }()
	v, err := a.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v < 1 {
		t.Fatalf("Readiness = %d, want >= 1", v)
	}
	if a.Store() == nil {
		t.Fatal("Store() must not be nil after Open")
	}
}

// Close releases the store before the log file: after Close, readiness
// fails and the log closer ran exactly once. Closing twice stays a no-op.
func TestCloseOrderStoreBeforeLog(t *testing.T) {
	closer := &testCloser{}
	a := open(t, context.Background(), t.TempDir(), closer)
	if err := a.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Readiness(context.Background()); err == nil {
		t.Fatal("Readiness after Close must fail: the store closed first")
	}
	if got := closer.count(); got != 1 {
		t.Fatalf("log closer ran %d times, want exactly 1 after store close", got)
	}
	if err := a.Close(); err != nil {
		t.Fatalf("second Close must be a no-op, got: %v", err)
	}
}
