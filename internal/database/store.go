// Package database owns durable local persistence: a single-connection
// SQLite store, explicit versioned migrations with VACUUM INTO backups, and
// readiness reporting. One open/idle connection serializes all access
// (ADR-0005); every method takes a context and no DB-level query ever runs
// while the single connection is held in a transaction.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

// Store is the single-connection SQLite handle. The zero value is not
// usable; use Open. A Store is safe for concurrent use: the lone connection
// serializes callers and the loser of a conflict fails honestly.
type Store struct {
	mu sync.Mutex
	db *sql.DB
	// expected is the highest migration version known to the binary,
	// recorded by Migrate on success. Readiness rejects any database
	// whose applied version differs.
	expected int
}

// fileURI builds the SQLite file URI for path with URL escaping applied per
// path segment, so Windows drive letters and spaces survive the round trip.
func fileURI(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	segs := strings.Split(filepath.ToSlash(abs), "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	escaped := strings.Join(segs, "/")
	if !strings.HasPrefix(escaped, "/") {
		escaped = "/" + escaped
	}
	return "file:" + escaped, nil
}

// dsn builds the connection string: the escaped file URI with mode=rwc and
// the connection-local settings (foreign keys, busy timeout, synchronous,
// immediate transactions) so reconnects retain them.
func dsn(path string) (string, error) {
	uri, err := fileURI(path)
	if err != nil {
		return "", err
	}
	return uri + "?mode=rwc&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=synchronous(FULL)&_txlock=immediate", nil
}

// Open connects to the SQLite database at path, creating it when absent.
// It enables and verifies journal_mode=WAL outside any transaction and
// fails when WAL is unavailable rather than silently weakening durability.
func Open(ctx context.Context, path string) (*Store, error) {
	if err := ctx.Err(); err != nil {
		return nil, fmt.Errorf("database: open cancelled: %v", err)
	}
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return nil, fmt.Errorf("database: cannot create directory: %v", err)
		}
	}
	dsn, err := dsn(path)
	if err != nil {
		return nil, fmt.Errorf("database: cannot build address: %v", err)
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("database: cannot open: %v", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("database: cannot reach: %v", err)
	}
	var mode string
	if err := db.QueryRowContext(ctx, "PRAGMA journal_mode=WAL;").Scan(&mode); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("database: cannot enable WAL: %v", err)
	}
	if !strings.EqualFold(mode, "wal") {
		_ = db.Close()
		return nil, fmt.Errorf("database: journal mode is %q, want WAL", mode)
	}
	return &Store{db: db}, nil
}

// Close releases the database handle. Later calls are no-ops returning nil.
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.db == nil {
		return nil
	}
	err := s.db.Close()
	s.db = nil
	if err != nil {
		return fmt.Errorf("database: cannot close: %v", err)
	}
	return nil
}

// setExpected records the highest migration version known to the binary.
// Called by Migrate on success, before the store is shared with callers.
func (s *Store) setExpected(v int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.expected = v
}

// Readiness reports the applied schema version, rejecting an unavailable
// database or a version mismatch against the migrated expectation. The
// health handler calls this with a short deadline; behind the single
// connection it tolerates waiting behind one short write.
func (s *Store) Readiness(ctx context.Context) (int, error) {
	s.mu.Lock()
	db := s.db
	expected := s.expected
	s.mu.Unlock()
	if db == nil {
		return 0, fmt.Errorf("database: unavailable")
	}
	var version sql.NullInt64
	if err := db.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_migrations;").Scan(&version); err != nil {
		return 0, fmt.Errorf("database: unavailable")
	}
	if !version.Valid {
		return 0, fmt.Errorf("database: unavailable")
	}
	if int(version.Int64) != expected {
		return 0, fmt.Errorf("database: unavailable")
	}
	return int(version.Int64), nil
}
