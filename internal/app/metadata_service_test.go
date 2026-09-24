package app

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"wyvern-drive/internal/database"
	"wyvern-drive/internal/domain"
	"wyvern-drive/internal/filesystem"
	"wyvern-drive/migrations"
)

func openMetadataService(t *testing.T, ctx context.Context) *MetadataService {
	t.Helper()
	dir := t.TempDir()
	store, err := database.Open(ctx, filepath.Join(dir, "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := database.Migrate(ctx, store, migrations.FS, filepath.Join(dir, "backups")); err != nil {
		t.Fatal(err)
	}
	return NewMetadataService(filesystem.New(store))
}

func codeOf(t *testing.T, err error) domain.Code {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	var derr *domain.Error
	if !errors.As(err, &derr) {
		t.Fatalf("error %v is not a domain error", err)
	}
	return derr.Code
}

func parseTime(t *testing.T, s string) time.Time {
	t.Helper()
	ts, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t.Fatalf("time %q is not RFC3339Nano: %v", s, err)
	}
	if ts.Location() != time.UTC {
		t.Fatalf("time %q is not UTC", s)
	}
	return ts
}

// The facade mirrors the eight folder operations with DTOs only: vault and
// entry fields round-trip, root parents stay nil, and sizes render exact.
func TestMetadataServiceFolderFlow(t *testing.T) {
	ctx := context.Background()
	m := openMetadataService(t, ctx)

	vault, err := m.CreateLocalVault(ctx, "Personal")
	if err != nil {
		t.Fatal(err)
	}
	if vault.ID == "" || vault.Name != "Personal" || vault.BackendType != "local-test" || vault.State != "metadata_only" {
		t.Fatalf("vault DTO = %+v", vault)
	}
	parseTime(t, vault.CreatedAt)
	parseTime(t, vault.UpdatedAt)

	got, err := m.GetVault(ctx, vault.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got != vault {
		t.Fatalf("GetVault = %+v, want %+v", got, vault)
	}
	if _, err := m.GetVault(ctx, "missing"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing vault: %v", err)
	}

	vaults, err := m.ListVaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(vaults) != 1 || vaults[0].ID != vault.ID {
		t.Fatalf("ListVaults = %+v", vaults)
	}

	projects, err := m.CreateFolder(ctx, vault.ID, nil, "Projects")
	if err != nil {
		t.Fatal(err)
	}
	if projects.VaultID != vault.ID || projects.ParentID != nil || projects.Kind != "folder" {
		t.Fatalf("folder DTO = %+v", projects)
	}
	if projects.Status != "available" || projects.Size != "0" || projects.MimeType != nil {
		t.Fatalf("folder shape = %+v", projects)
	}

	docs, err := m.CreateFolder(ctx, vault.ID, &projects.ID, "Docs")
	if err != nil {
		t.Fatal(err)
	}
	if docs.ParentID == nil || *docs.ParentID != projects.ID {
		t.Fatalf("nested DTO = %+v", docs)
	}

	renamed, err := m.RenameEntry(ctx, docs.ID, "Notes")
	if err != nil {
		t.Fatal(err)
	}
	if renamed.Name != "Notes" || renamed.ID != docs.ID {
		t.Fatalf("renamed DTO = %+v", renamed)
	}

	moved, err := m.MoveEntry(ctx, renamed.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if moved.ParentID != nil {
		t.Fatalf("moved DTO = %+v", moved)
	}

	roots, err := m.ListEntries(ctx, vault.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if roots == nil || len(roots) != 2 {
		t.Fatalf("roots = %+v", roots)
	}

	if err := m.DeleteFolder(ctx, projects.ID, false); err != nil {
		t.Fatal(err)
	}
	if err := m.DeleteFolder(ctx, moved.ID, false); err != nil {
		t.Fatal(err)
	}
	if _, err := m.CreateFolder(ctx, vault.ID, nil, ""); codeOf(t, err) != domain.CodeInvalidName {
		t.Fatalf("invalid name: %v", err)
	}
}

// A nil parent and a nil MIME type marshal as JSON null, never as an
// omitted field or an empty string.
func TestEntryDTONullsStayNull(t *testing.T) {
	raw, err := json.Marshal(toEntryDTO(newTestEntry(nil, nil)))
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if v, ok := decoded["parent_id"]; !ok || v != nil {
		t.Fatalf("parent_id = %v (present=%v), want explicit null", v, ok)
	}
	if v, ok := decoded["mime_type"]; !ok || v != nil {
		t.Fatalf("mime_type = %v (present=%v), want explicit null", v, ok)
	}
}

// Sizes render as decimal strings so large int64 values survive JSON
// numbers exactly.
func TestEntryDTOLargeSize(t *testing.T) {
	e := newTestEntry(nil, nil)
	e.Size = math.MaxInt64
	dto := toEntryDTO(e)
	if dto.Size != strconv.FormatInt(math.MaxInt64, 10) {
		t.Fatalf("size = %q, want %q", dto.Size, strconv.FormatInt(math.MaxInt64, 10))
	}
	if _, err := strconv.ParseInt(dto.Size, 10, 64); err != nil {
		t.Fatalf("size %q does not parse back to int64: %v", dto.Size, err)
	}
}

func newTestEntry(parent, mime *string) domain.Entry {
	now := time.Now().UTC()
	return domain.Entry{
		ID: "entry-1", VaultID: "vault-1", ParentID: parent,
		Kind: domain.EntryKindFolder, Name: "Docs", NameKey: "docs",
		Status: domain.EntryStatusAvailable, Size: 0, MimeType: mime,
		CreatedAt: now, UpdatedAt: now,
	}
}

// Typed domain errors keep their code and safe message; anything
// unexpected becomes DATABASE_UNAVAILABLE with a static message; every
// path returns valid JSON with an empty details object.
func TestMarshalErrorEnvelope(t *testing.T) {
	for _, tc := range []struct {
		err     error
		code    string
		message string
	}{
		{domain.New(domain.CodeFileConflict, "entry name already exists"), "FILE_CONFLICT", "entry name already exists"},
		{domain.New(domain.CodeNotFound, "vault not found"), "NOT_FOUND", "vault not found"},
		{errors.New("sql: connection reset"), "DATABASE_UNAVAILABLE", "database operation failed"},
	} {
		raw := MarshalError(tc.err)
		var env ErrorEnvelope
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			t.Fatalf("MarshalError(%v) = %q, not valid JSON: %v", tc.err, raw, err)
		}
		if env.Code != tc.code || env.Message != tc.message {
			t.Fatalf("envelope = %+v, want code %q message %q", env, tc.code, tc.message)
		}
		if env.Details == nil || len(env.Details) != 0 {
			t.Fatalf("details = %v, want empty object", env.Details)
		}
		if got := coerceError(tc.err).Error(); got != tc.message {
			t.Fatalf("Error() = %q, want %q", got, tc.message)
		}
	}
	var fallback ErrorEnvelope
	if err := json.Unmarshal([]byte(fallbackEnvelope), &fallback); err != nil {
		t.Fatalf("fallback is not valid JSON: %v", err)
	}
	if fallback.Code != "DATABASE_UNAVAILABLE" {
		t.Fatalf("fallback = %+v", fallback)
	}
}
