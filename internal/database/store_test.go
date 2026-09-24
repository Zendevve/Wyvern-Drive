package database

import (
	"context"
	"path/filepath"
	"testing"
)

// A fresh temp-file database opens with WAL enabled, then migrates to the
// production version and reports readiness at that version.
func TestOpenMigrateReadiness(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if err := Migrate(ctx, store, testFoundationFS(), t.TempDir()); err != nil {
		t.Fatal(err)
	}
	v, err := store.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != 1 {
		t.Fatalf("Readiness = %d, want 1", v)
	}
}

// Reopening the same file preserves applied versions: the second run is a
// no-op and readiness stays at the same version.
func TestReopenPersistsMigration(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	path := filepath.Join(dir, "wyvern.sqlite")
	first, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, first, testFoundationFS(), t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	second, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = second.Close() }()
	if err := Migrate(ctx, second, testFoundationFS(), t.TempDir()); err != nil {
		t.Fatal(err)
	}
	v, err := second.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != 1 {
		t.Fatalf("Readiness after reopen = %d, want 1", v)
	}
}

// A path containing spaces opens and migrates: URL escaping must round-trip
// the filename instead of creating a stray file.
func TestOpenPathWithSpaces(t *testing.T) {
	ctx := context.Background()
	dir := filepath.Join(t.TempDir(), "my dir")
	path := filepath.Join(dir, "wyvern.sqlite")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if err := Migrate(ctx, store, testFoundationFS(), t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Readiness(ctx); err != nil {
		t.Fatal(err)
	}
}
