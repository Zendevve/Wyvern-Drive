package database

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// A version-1 database holding a setting upgrades to version 2, retains
// the row, reports version 2, and leaves a backup that reopens with the
// pre-upgrade data.
func TestMigrateUpgradeKeepsSettingAndBacksUp(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	backups := filepath.Join(dir, "backups")
	if err := Migrate(ctx, store, testFoundationFS(), backups); err != nil {
		t.Fatal(err)
	}
	mustExec(t, ctx, store, `INSERT INTO settings(key, value) VALUES('theme', 'dark');`)
	if err := Migrate(ctx, store, testTwoVersionFS(), backups); err != nil {
		t.Fatal(err)
	}
	v, err := store.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != 2 {
		t.Fatalf("Readiness = %d, want 2", v)
	}
	var value string
	mustQuery(t, ctx, store, &value, `SELECT value FROM settings WHERE key='theme';`)
	if value != "dark" {
		t.Fatalf("setting value = %q, want %q", value, "dark")
	}
	entries, err := os.ReadDir(backups)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || !strings.HasPrefix(entries[0].Name(), "pre-migration-") || !strings.HasSuffix(entries[0].Name(), ".sqlite") {
		names := []string{}
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("backups = %q, want one pre-migration-*.sqlite", names)
	}
	backupDB, err := sql.Open("sqlite", "file:"+filepath.Join(backups, entries[0].Name())+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = backupDB.Close() }()
	var backupValue string
	if err := backupDB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key='theme';`).Scan(&backupValue); err != nil {
		t.Fatalf("backup must reopen with pre-upgrade data: %v", err)
	}
	if backupValue != "dark" {
		t.Fatalf("backup value = %q, want %q", backupValue, "dark")
	}
}

// Fresh databases take no backup: there is nothing to preserve.
func TestMigrateFreshTakesNoBackup(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	backups := filepath.Join(t.TempDir(), "backups")
	if err := Migrate(ctx, store, testFoundationFS(), backups); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(backups); !os.IsNotExist(err) {
		entries, _ := os.ReadDir(backups)
		if len(entries) != 0 {
			t.Fatalf("fresh migrate must take no backup, found %d files", len(entries))
		}
	}
}

// A failing pending migration rolls back everything: schema, version row
// and data stay at the previous state.
func TestMigrateFailureRollsBack(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	backups := filepath.Join(dir, "backups")
	if err := Migrate(ctx, store, testFoundationFS(), backups); err != nil {
		t.Fatal(err)
	}
	mustExec(t, ctx, store, `INSERT INTO settings(key, value) VALUES('theme', 'dark');`)
	bad := fstest.MapFS{
		"0001_foundation.sql": {Data: []byte("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);")},
		"0002_broken.sql":     {Data: []byte("CREATE TABLE ok(a TEXT); THIS IS NOT SQL;")},
	}
	if err := Migrate(ctx, store, bad, backups); err == nil {
		t.Fatal("expected migration failure, got nil")
	}
	var count int
	mustQuery(t, ctx, store, &count, `SELECT COUNT(*) FROM schema_migrations;`)
	if count != 1 {
		t.Fatalf("applied versions = %d, want 1 after rollback", count)
	}
	var value string
	mustQuery(t, ctx, store, &value, `SELECT value FROM settings WHERE key='theme';`)
	if value != "dark" {
		t.Fatalf("setting value = %q, want %q after rollback", value, "dark")
	}
	if tableExists(ctx, t, store, "ok") {
		t.Fatal("failed migration must not leave partial tables")
	}
}

// Changed checksums of applied migrations refuse startup.
func TestMigrateChecksumMismatchRefuses(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if err := Migrate(ctx, store, testFoundationFS(), filepath.Join(dir, "backups")); err != nil {
		t.Fatal(err)
	}
	changed := fstest.MapFS{
		"0001_foundation.sql": {Data: []byte("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, extra TEXT);")},
	}
	if err := Migrate(ctx, store, changed, filepath.Join(dir, "backups")); err == nil {
		t.Fatal("expected checksum mismatch, got nil")
	}
}

// A database newer than the known migrations refuses startup.
func TestMigrateNewerThanKnownRefuses(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if err := Migrate(ctx, store, testTwoVersionFS(), filepath.Join(dir, "backups")); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, store, testFoundationFS(), filepath.Join(dir, "backups")); err == nil {
		t.Fatal("expected newer-than-known refusal, got nil")
	}
}

// A gap in the known versions refuses startup instead of silently skipping.
func TestMigrateGapRefuses(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	gapped := fstest.MapFS{
		"0001_foundation.sql": {Data: []byte("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);")},
		"0003_skip.sql":       {Data: []byte("CREATE TABLE skipped(a TEXT);")},
	}
	if err := Migrate(ctx, store, gapped, t.TempDir()); err == nil {
		t.Fatal("expected gap refusal, got nil")
	}
}

// A backup failure aborts migration before any schema write: the version,
// data and schema stay exactly as before, with no partial v2 objects.
func TestMigrateBackupFailureAborts(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if err := Migrate(ctx, store, testFoundationFS(), filepath.Join(dir, "backups")); err != nil {
		t.Fatal(err)
	}
	mustExec(t, ctx, store, `INSERT INTO settings(key, value) VALUES('theme', 'dark');`)
	// A regular file where the backup directory should be: MkdirAll fails
	// and VACUUM INTO never runs.
	blocker := filepath.Join(dir, "blocker")
	if err := os.WriteFile(blocker, []byte("not a directory"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, store, testTwoVersionFS(), blocker); err == nil {
		t.Fatal("expected backup failure, got nil")
	}
	var count int
	mustQuery(t, ctx, store, &count, `SELECT COUNT(*) FROM schema_migrations;`)
	if count != 1 {
		t.Fatalf("applied versions = %d, want 1 after backup failure", count)
	}
	var value string
	mustQuery(t, ctx, store, &value, `SELECT value FROM settings WHERE key='theme';`)
	if value != "dark" {
		t.Fatalf("setting value = %q, want %q after backup failure", value, "dark")
	}
	if columnExists(ctx, t, store, "settings", "note") {
		t.Fatal("backup failure must not leave partial v2 schema")
	}
	v, err := store.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != 1 {
		t.Fatalf("Readiness = %d, want 1 after backup failure", v)
	}
}

func mustExec(t *testing.T, ctx context.Context, store *Store, query string) {
	t.Helper()
	store.mu.Lock()
	db := store.db
	store.mu.Unlock()
	if _, err := db.ExecContext(ctx, query); err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
}

func mustQuery(t *testing.T, ctx context.Context, store *Store, dest any, query string) {
	t.Helper()
	store.mu.Lock()
	db := store.db
	store.mu.Unlock()
	switch d := dest.(type) {
	case *string:
		if err := db.QueryRowContext(ctx, query).Scan(d); err != nil {
			t.Fatalf("query %q: %v", query, err)
		}
	case *int:
		if err := db.QueryRowContext(ctx, query).Scan(d); err != nil {
			t.Fatalf("query %q: %v", query, err)
		}
	default:
		t.Fatalf("unsupported dest type for %q", query)
	}
}

func tableExists(ctx context.Context, t *testing.T, store *Store, name string) bool {
	t.Helper()
	store.mu.Lock()
	db := store.db
	store.mu.Unlock()
	var found string
	err := db.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`, name).Scan(&found)
	if err == sql.ErrNoRows {
		return false
	}
	if err != nil {
		t.Fatalf("inspect schema: %v", err)
	}
	return true
}

func columnExists(ctx context.Context, t *testing.T, store *Store, table, column string) bool {
	t.Helper()
	store.mu.Lock()
	db := store.db
	store.mu.Unlock()
	rows, err := db.QueryContext(ctx, `PRAGMA table_info(`+table+`);`)
	if err != nil {
		t.Fatalf("inspect columns: %v", err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("inspect columns: %v", err)
		}
		if name == column {
			return true
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("inspect columns: %v", err)
	}
	return false
}
