// Allowlisted logging tests: append/close behavior on fresh temp data dirs,
// level filtering, and the attribute allowlist (operation names, IDs,
// durations, error codes only).
package logging

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func logPath(t *testing.T, dataDir string) string {
	t.Helper()
	return filepath.Join(dataDir, "logs", "wyvern.jsonl")
}

func readLines(t *testing.T, path string) []map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var out []map[string]any
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("log line is not JSON: %v\nline: %s", err, line)
		}
		out = append(out, entry)
	}
	return out
}

// A fresh data dir gains logs/wyvern.jsonl; records append; Close is
// idempotent and a second open appends rather than truncates.
func TestNewAppendsAndCloses(t *testing.T) {
	dataDir := t.TempDir()

	logger, closer, err := New(dataDir, slog.LevelInfo)
	if err != nil {
		t.Fatal(err)
	}
	logger.Info("first", "op", "metadata-only vault probe")
	if err := closer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := closer.Close(); err != nil {
		t.Fatalf("second Close must be a no-op, got: %v", err)
	}

	logger2, closer2, err := New(dataDir, slog.LevelInfo)
	if err != nil {
		t.Fatal(err)
	}
	logger2.Info("second", "op", "metadata-only vault probe")
	if err := closer2.Close(); err != nil {
		t.Fatal(err)
	}

	lines := readLines(t, logPath(t, dataDir))
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want 2 (append, never truncate)", len(lines))
	}
	if lines[0]["msg"] != "first" || lines[1]["msg"] != "second" {
		t.Fatalf("unexpected messages: %v", lines)
	}
	if lines[0]["op"] != "metadata-only vault probe" {
		t.Fatalf("operation name not logged: %v", lines[0])
	}
}

// Only operation names, IDs, durations and error codes survive; config,
// arguments, URLs, bodies and wrapped error chains are dropped, including
// via With and groups.
func TestNewAllowlistDropsSensitiveAttrs(t *testing.T) {
	dataDir := t.TempDir()
	logger, closer, err := New(dataDir, slog.LevelDebug)
	if err != nil {
		t.Fatal(err)
	}
	logger.With("config_path", `C:\secrets\config.json`, "args", "--listen 0.0.0.0").
		Info("op ran",
			"op", "create vault",
			"vault_id", "abc123",
			"entry_id", "def456",
			"duration_ms", 12,
			"code", "FILE_CONFLICT",
			"url", "http://127.0.0.1:9847/api/v1/health",
			"body", `{"name":"Personal"}`,
			"error", "dial tcp: connection refused caused by x",
		)
	logger.WithGroup("request").Info("grouped", "op", "move", "body", "must not appear")
	if err := closer.Close(); err != nil {
		t.Fatal(err)
	}

	lines := readLines(t, logPath(t, dataDir))
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	first := lines[0]
	for _, key := range []string{"op", "vault_id", "entry_id", "duration_ms", "code"} {
		if _, ok := first[key]; !ok {
			t.Errorf("allowlisted key %q missing from %v", key, first)
		}
	}
	for _, key := range []string{"config_path", "args", "url", "body", "error"} {
		if _, ok := first[key]; ok {
			t.Errorf("sensitive key %q leaked into %v", key, first)
		}
	}
	second := lines[1]
	if second["op"] != "move" {
		t.Errorf("grouped op missing: %v", second)
	}
	if _, ok := second["body"]; ok {
		t.Errorf("grouped sensitive key leaked: %v", second)
	}
	if _, ok := second["request"]; ok {
		t.Errorf("group name must not be logged: %v", second)
	}
}

// Records below the configured level never reach the file.
func TestNewLevelFiltering(t *testing.T) {
	dataDir := t.TempDir()
	logger, closer, err := New(dataDir, slog.LevelWarn)
	if err != nil {
		t.Fatal(err)
	}
	logger.Info("dropped", "op", "quiet")
	logger.Error("kept", "op", "loud", "code", "DATABASE_UNAVAILABLE")
	if err := closer.Close(); err != nil {
		t.Fatal(err)
	}
	lines := readLines(t, logPath(t, dataDir))
	if len(lines) != 1 || lines[0]["msg"] != "kept" {
		t.Fatalf("level filtering wrong: %v", lines)
	}
}

// A blocked log location fails startup instead of silently losing logs.
func TestNewOpenFailure(t *testing.T) {
	blocker := t.TempDir()
	if err := os.WriteFile(filepath.Join(blocker, "logs"), []byte("not a dir"), 0o600); err != nil {
		t.Fatal(err)
	}
	logger, closer, err := New(blocker, slog.LevelInfo)
	if err == nil {
		_ = closer.Close()
		t.Fatal("expected log-open failure, got nil")
	}
	if logger != nil {
		t.Fatal("failed New must return a nil logger")
	}
}

func TestParseLevel(t *testing.T) {
	for input, want := range map[string]slog.Level{
		"DEBUG": slog.LevelDebug,
		"INFO":  slog.LevelInfo,
		"WARN":  slog.LevelWarn,
		"ERROR": slog.LevelError,
		"debug": slog.LevelDebug,
		"info":  slog.LevelInfo,
	} {
		got, err := ParseLevel(input)
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("ParseLevel(%q) = %v, want %v", input, got, want)
		}
	}
	if _, err := ParseLevel("VERBOSE"); err == nil {
		t.Fatal("expected error for bogus level")
	}
	if _, err := ParseLevel(""); err == nil {
		t.Fatal("expected error for empty level")
	}
}

func TestNewLogFileMode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX file modes do not enforce Windows ACLs; the data directory inherits user ACLs")
	}
	dataDir := t.TempDir()
	_, closer, err := New(dataDir, slog.LevelInfo)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = closer.Close() }()
	info, err := os.Stat(logPath(t, dataDir))
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Fatalf("log file mode = %o, want 600", perm)
	}
}
