// Package logging provides the allowlisted application logger.
//
// New fans out to an append-only logs/wyvern.jsonl JSON handler plus a
// stderr text handler. Both handlers see only allowlisted attributes:
// operation names (op), record IDs (vault_id, entry_id), durations
// (duration_ms) and machine-readable error codes (code). Everything else —
// config values, arguments, URLs, bodies, wrapped error chains — is dropped
// before it can reach any output, so later phases cannot establish a
// secret-leaking logging convention by accident. There is no telemetry.
package logging

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// allowedAttrs is the complete attribute allowlist. slog's built-in time,
// level and message keys are added by the handlers themselves and need no
// entry here.
var allowedAttrs = map[string]bool{
	"op":          true,
	"vault_id":    true,
	"entry_id":    true,
	"duration_ms": true,
	"code":        true,
}

// New creates the data-directory log area and returns a logger writing to
// both the JSON lines file and stderr. The caller owns the returned closer
// and must close it (usually via the application core); Close is idempotent.
// If the log file cannot be opened, New emits a safe static stderr error and
// fails startup with a non-nil error and a nil logger.
func New(dir string, level slog.Level) (*slog.Logger, io.Closer, error) {
	logsDir := filepath.Join(dir, "logs")
	if err := os.MkdirAll(logsDir, 0o700); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "wyvernd: cannot open log file: log directory unavailable")
		return nil, nil, fmt.Errorf("cannot open log file: %v", err)
	}
	path := filepath.Join(logsDir, "wyvern.jsonl")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "wyvernd: cannot open log file: check data directory permissions")
		return nil, nil, fmt.Errorf("cannot open log file: %v", err)
	}
	fanout := &fanoutHandler{
		level:  level,
		file:   &allowHandler{next: slog.NewJSONHandler(f, nil)},
		stderr: &allowHandler{next: slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})},
	}
	return slog.New(fanout), &fileCloser{f: f}, nil
}

// ParseLevel maps a user-supplied level name to slog.Level. It accepts
// DEBUG, INFO, WARN and ERROR case-insensitively; anything else is an error.
func ParseLevel(s string) (slog.Level, error) {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "DEBUG":
		return slog.LevelDebug, nil
	case "INFO":
		return slog.LevelInfo, nil
	case "WARN":
		return slog.LevelWarn, nil
	case "ERROR":
		return slog.LevelError, nil
	default:
		return slog.LevelInfo, fmt.Errorf("invalid log level: must be DEBUG, INFO, WARN or ERROR")
	}
}

// fileCloser owns the JSON lines log file. Close is idempotent: the first
// call closes the file, later calls are no-ops returning nil.
type fileCloser struct {
	mu     sync.Mutex
	f      *os.File
	closed bool
}

func (c *fileCloser) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	c.closed = true
	return c.f.Close()
}

// fanoutHandler gates records by level, then delivers the same record to the
// file and stderr handlers.
type fanoutHandler struct {
	level  slog.Level
	file   slog.Handler
	stderr slog.Handler
}

func (h *fanoutHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *fanoutHandler) Handle(ctx context.Context, r slog.Record) error {
	if err := h.file.Handle(ctx, r); err != nil {
		return err
	}
	return h.stderr.Handle(ctx, r)
}

func (h *fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	sanitized := sanitizeAttrs(attrs)
	return &fanoutHandler{
		level:  h.level,
		file:   h.file.WithAttrs(sanitized),
		stderr: h.stderr.WithAttrs(sanitized),
	}
}

// WithGroup drops the group name: grouped attributes flatten into the parent
// record and are sanitized there, so group names can never smuggle structure
// (or sensitive keys) past the allowlist.
func (h *fanoutHandler) WithGroup(string) slog.Handler { return h }

// allowHandler strips every non-allowlisted attribute before delegating.
type allowHandler struct {
	next slog.Handler
}

func (h *allowHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *allowHandler) Handle(ctx context.Context, r slog.Record) error {
	filtered := slog.NewRecord(r.Time, r.Level, r.Message, r.PC)
	r.Attrs(func(a slog.Attr) bool {
		filtered.AddAttrs(flattenAttr(a)...)
		return true
	})
	return h.next.Handle(ctx, filtered)
}

func (h *allowHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &allowHandler{next: h.next.WithAttrs(sanitizeAttrs(attrs))}
}

func (h *allowHandler) WithGroup(string) slog.Handler { return h }

func sanitizeAttrs(attrs []slog.Attr) []slog.Attr {
	var kept []slog.Attr
	for _, a := range attrs {
		kept = append(kept, flattenAttr(a)...)
	}
	return kept
}

// flattenAttr keeps an allowlisted attribute, drops anything else, and
// expands group values so an allowlisted key survives nesting while the
// group name itself is never logged.
func flattenAttr(a slog.Attr) []slog.Attr {
	if a.Value.Kind() == slog.KindGroup {
		var kept []slog.Attr
		for _, inner := range a.Value.Group() {
			kept = append(kept, flattenAttr(inner)...)
		}
		return kept
	}
	if allowedAttrs[a.Key] {
		return []slog.Attr{a}
	}
	return nil
}
