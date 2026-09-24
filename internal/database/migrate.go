package database

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"wyvern-drive/internal/domain"
)

// filenameRe enforces the NNNN_description.sql naming contract.
var filenameRe = regexp.MustCompile(`^([0-9]{4})_[a-z0-9_]+\.sql$`)

// migration is one parsed migration file: its version, filename and exact
// SQL bytes (checksummed verbatim).
type migration struct {
	version int
	name    string
	sql     []byte
}

// backupFileName builds the unique pre-migration backup name:
// pre-migration-<UTC timestamp>-<random ID>.sqlite.
func backupFileName() (string, error) {
	id, err := domain.NewID()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("pre-migration-%s-%s.sqlite", time.Now().UTC().Format("20060102T150405Z"), id), nil
}

// loadMigrations reads and validates every NNNN_description.sql entry in
// source: names match the pattern, versions are consecutive from 1 with no
// gaps, and each body's checksum is lowercase hex SHA-256 over exact bytes.
func loadMigrations(source fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(source, ".")
	if err != nil {
		return nil, fmt.Errorf("database: cannot read migrations: %v", err)
	}
	var out []migration
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		m := filenameRe.FindStringSubmatch(name)
		if m == nil {
			return nil, fmt.Errorf("database: invalid migration name %q", name)
		}
		v, err := strconv.Atoi(m[1])
		if err != nil {
			return nil, fmt.Errorf("database: invalid migration name %q", name)
		}
		body, err := fs.ReadFile(source, name)
		if err != nil {
			return nil, fmt.Errorf("database: cannot read migration %q: %v", name, err)
		}
		out = append(out, migration{version: v, name: name, sql: body})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	for i, m := range out {
		if m.version != i+1 {
			return nil, fmt.Errorf("database: migration gap: want version %d, found %q", i+1, m.name)
		}
	}
	return out, nil
}

// checksum returns the lowercase-hex SHA-256 over the exact SQL bytes.
func checksum(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

// ensureVersionTable creates schema_migrations when absent.
func ensureVersionTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL);`)
	if err != nil {
		return fmt.Errorf("database: cannot prepare migrations: %v", err)
	}
	return nil
}

// appliedVersions returns the checksums recorded for each applied version.
func appliedVersions(ctx context.Context, db *sql.DB) (map[int]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT version, checksum FROM schema_migrations;`)
	if err != nil {
		return nil, fmt.Errorf("database: cannot read migrations: %v", err)
	}
	defer func() { _ = rows.Close() }()
	out := map[int]string{}
	for rows.Next() {
		var v int
		var c string
		if err := rows.Scan(&v, &c); err != nil {
			return nil, fmt.Errorf("database: cannot read migrations: %v", err)
		}
		out[v] = c
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("database: cannot read migrations: %v", err)
	}
	return out, nil
}

// nonEmptyDB reports whether the application database holds any user tables
// besides the migration bookkeeping (and SQLite internals). Fresh databases
// skip the pre-migration backup; nonempty ones get one.
func nonEmptyDB(ctx context.Context, db *sql.DB) (bool, error) {
	rows, err := db.QueryContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations';`)
	if err != nil {
		return false, fmt.Errorf("database: cannot inspect schema: %v", err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return false, fmt.Errorf("database: cannot inspect schema: %v", err)
		}
		return true, nil
	}
	return false, rows.Err()
}

// backup snapshots the live database via parameterized VACUUM INTO, outside
// any transaction and before new schema writes. Never a plain file copy of
// a WAL database.
func backup(ctx context.Context, db *sql.DB, backupDir string) error {
	name, err := backupFileName()
	if err != nil {
		return fmt.Errorf("database: cannot name backup: %v", err)
	}
	if err := os.MkdirAll(backupDir, 0o700); err != nil {
		return fmt.Errorf("database: cannot create backup directory")
	}
	dest := filepath.Join(backupDir, name)
	if _, err := db.ExecContext(ctx, `VACUUM INTO ?;`, dest); err != nil {
		return fmt.Errorf("database: cannot back up before migration")
	}
	return nil
}

// utcMillis returns UTC Unix milliseconds for applied_at storage.
func utcMillis() int64 {
	return time.Now().UTC().UnixMilli()
}

// Migrate brings the database at store to the highest version in source.
// It verifies applied checksums, refuses newer-than-known databases, runs
// all pending SQL plus version inserts in one transaction (rolling back all
// on failure), and records the expected version on success. Re-running with
// nothing pending is a no-op. Before applying pending migrations to a
// nonempty database it takes a unique VACUUM INTO snapshot under backupDir,
// outside any transaction; backup failure aborts. Never starts listeners or
// UI: callers proceed only on nil error.
func Migrate(ctx context.Context, store *Store, source fs.FS, backupDir string) error {
	known, err := loadMigrations(source)
	if err != nil {
		return err
	}
	store.mu.Lock()
	db := store.db
	store.mu.Unlock()
	if db == nil {
		return fmt.Errorf("database: unavailable")
	}
	if err := ensureVersionTable(ctx, db); err != nil {
		return err
	}
	applied, err := appliedVersions(ctx, db)
	if err != nil {
		return err
	}
	want := map[int]migration{}
	for _, m := range known {
		want[m.version] = m
	}
	for v, c := range applied {
		m, ok := want[v]
		if !ok {
			return fmt.Errorf("database: schema version %d is newer than this binary", v)
		}
		if checksum(m.sql) != c {
			return fmt.Errorf("database: migration %q checksum mismatch", m.name)
		}
	}
	var pending []migration
	for _, m := range known {
		if _, ok := applied[m.version]; !ok {
			pending = append(pending, m)
		}
	}
	highest := 0
	if len(known) > 0 {
		highest = known[len(known)-1].version
	}
	if len(pending) == 0 {
		store.setExpected(highest)
		return nil
	}
	needsBackup, err := nonEmptyDB(ctx, db)
	if err != nil {
		return err
	}
	if needsBackup {
		if err := backup(ctx, db, backupDir); err != nil {
			return err
		}
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("database: cannot begin migration: %v", err)
	}
	rolledBack := false
	defer func() {
		if !rolledBack {
			_ = tx.Rollback()
		}
	}()
	for _, m := range pending {
		if _, err := tx.ExecContext(ctx, string(m.sql)); err != nil {
			return fmt.Errorf("database: cannot apply migration %q: %v", m.name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES(?, ?, ?, ?);`, m.version, m.name, checksum(m.sql), utcMillis()); err != nil {
			return fmt.Errorf("database: cannot record migration %q: %v", m.name, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("database: cannot commit migrations: %v", err)
	}
	rolledBack = true
	store.setExpected(highest)
	return nil
}
