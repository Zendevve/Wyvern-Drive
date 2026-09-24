package database

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"
	"testing"
	"testing/fstest"
	"time"

	"wyvern-drive/internal/domain"
	"wyvern-drive/migrations"
)

// openMetadataStore opens a temp-file database migrated to the production
// schema: the metadata-only Vault records under test always run against the
// real 0002 metadata tables, never fixtures.
func openMetadataStore(t *testing.T, ctx context.Context) *Store {
	t.Helper()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	if err := Migrate(ctx, store, migrations.FS, filepath.Join(t.TempDir(), "backups")); err != nil {
		t.Fatal(err)
	}
	return store
}

// millisNow returns a millisecond-aligned UTC timestamp: storage keeps UTC
// millis, so aligned inputs compare exactly at the API boundary.
func millisNow() time.Time { return time.Now().UTC().Truncate(time.Millisecond) }

// codeOf unwraps a repository error to its stable domain code.
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

// seedMetadataOnlyVault stores a backend-less dev namespace (a metadata-only
// Vault) and returns it.
func seedMetadataOnlyVault(t *testing.T, ctx context.Context, store *Store, id, name string) domain.Vault {
	t.Helper()
	now := millisNow()
	v := domain.Vault{
		ID: id, Name: name,
		BackendType: "local-test", State: domain.VaultStateMetadataOnly,
		ChunkSize: 16777216,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertVault(ctx, v) }); err != nil {
		t.Fatalf("seed metadata-only Vault: %v", err)
	}
	return v
}

// seedEntry stores one entry row inside a transaction.
func seedEntry(t *testing.T, ctx context.Context, store *Store, e domain.Entry) domain.Entry {
	t.Helper()
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, e) }); err != nil {
		t.Fatalf("seed entry %q: %v", e.Name, err)
	}
	return e
}

// newEntry builds a folder or file entry with millisecond timestamps.
func newEntry(id, vaultID string, parentID *string, kind domain.EntryKind, name, nameKey string) domain.Entry {
	now := millisNow()
	return domain.Entry{
		ID: id, VaultID: vaultID, ParentID: parentID,
		Kind: kind, Name: name, NameKey: nameKey,
		Status:    domain.EntryStatusAvailable,
		CreatedAt: now, UpdatedAt: now,
	}
}

// equalVault compares Vault records field by field, through the UTC-millis
// boundary.
func equalVault(a, b domain.Vault) bool {
	if a.ID != b.ID || a.Name != b.Name || a.BackendType != b.BackendType || a.State != b.State || a.ChunkSize != b.ChunkSize {
		return false
	}
	if (a.EncryptedVaultKey == nil) != (b.EncryptedVaultKey == nil) || string(a.EncryptedVaultKey) != string(b.EncryptedVaultKey) {
		return false
	}
	if (a.RecoveryAnchorMessageID == nil) != (b.RecoveryAnchorMessageID == nil) {
		return false
	}
	if a.RecoveryAnchorMessageID != nil && *a.RecoveryAnchorMessageID != *b.RecoveryAnchorMessageID {
		return false
	}
	return a.CreatedAt.UnixMilli() == b.CreatedAt.UnixMilli() && a.UpdatedAt.UnixMilli() == b.UpdatedAt.UnixMilli()
}

// A stored metadata-only Vault round-trips through both Store reads and an
// in-transaction read; a missing ID is NOT_FOUND.
func TestMetadataOnlyVaultRoundTrip(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	want := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")

	got, err := store.GetVault(ctx, "vault-1")
	if err != nil {
		t.Fatal(err)
	}
	if !equalVault(want, got) {
		t.Fatalf("GetVault = %+v, want %+v", got, want)
	}
	listed, err := store.ListVaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || !equalVault(want, listed[0]) {
		t.Fatalf("ListVaults = %+v, want [%+v]", listed, want)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		txGot, err := tx.GetVault(ctx, "vault-1")
		if err != nil {
			return err
		}
		if !equalVault(want, txGot) {
			t.Fatalf("Tx.GetVault = %+v, want %+v", txGot, want)
		}
		txListed, err := tx.ListVaults(ctx)
		if err != nil {
			return err
		}
		if len(txListed) != 1 {
			t.Fatalf("Tx.ListVaults has %d rows, want 1", len(txListed))
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if code := codeOf(t, func() error { _, err := store.GetVault(ctx, "missing"); return err }()); code != domain.CodeNotFound {
		t.Fatalf("GetVault missing code = %q, want NOT_FOUND", code)
	}
}

// A duplicate Vault ID is FILE_CONFLICT and stores nothing new.
func TestMetadataOnlyVaultDuplicateRejects(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	dup := seedMetadataOnlyVaultSource("vault-1", "Personal")
	err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertVault(ctx, dup) })
	if code := codeOf(t, err); code != domain.CodeFileConflict {
		t.Fatalf("duplicate Vault code = %q, want FILE_CONFLICT", code)
	}
	listed, err := store.ListVaults(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 {
		t.Fatalf("ListVaults has %d rows after conflict, want 1", len(listed))
	}
}

func seedMetadataOnlyVaultSource(id, name string) domain.Vault {
	now := millisNow()
	return domain.Vault{
		ID: id, Name: name,
		BackendType: "local-test", State: domain.VaultStateMetadataOnly,
		ChunkSize: 16777216,
		CreatedAt: now, UpdatedAt: now,
	}
}

// Entries list per parent in stable name order; sibling names collide while
// the same name in another folder or Vault succeeds. Parent problems are
// INVALID_PARENT and a missing Vault is NOT_FOUND.
func TestEntryHierarchyAndNameRules(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	other := seedMetadataOnlyVault(t, ctx, store, "vault-2", "Work")

	projects := seedEntry(t, ctx, store, newEntry("projects", v.ID, nil, domain.EntryKindFolder, "Projects", "projects"))
	seedEntry(t, ctx, store, newEntry("docs", v.ID, &projects.ID, domain.EntryKindFolder, "Docs", "docs"))
	seedEntry(t, ctx, store, newEntry("notes-file", v.ID, &projects.ID, domain.EntryKindFile, "a-notes.txt", "a-notes.txt"))

	roots, err := store.ListEntries(ctx, v.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(roots) != 1 || roots[0].ID != "projects" {
		t.Fatalf("roots = %+v, want [projects]", roots)
	}
	children, err := store.ListEntries(ctx, v.ID, &projects.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(children) != 2 || children[0].ID != "notes-file" || children[1].ID != "docs" {
		t.Fatalf("children order = %+v, want [notes-file docs] by name_key", children)
	}
	got, err := store.GetEntry(ctx, "docs")
	if err != nil {
		t.Fatal(err)
	}
	if got.VaultID != v.ID || got.ParentID == nil || *got.ParentID != "projects" {
		t.Fatalf("GetEntry = %+v, want vault-1/projects parent", got)
	}
	if code := codeOf(t, func() error { _, err := store.GetEntry(ctx, "missing"); return err }()); code != domain.CodeNotFound {
		t.Fatalf("GetEntry missing code = %q, want NOT_FOUND", code)
	}

	dupRoot := newEntry("other-id", v.ID, nil, domain.EntryKindFolder, "PROJECTS", "projects")
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, dupRoot) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate root name code = %v, want FILE_CONFLICT", err)
	}
	dupID := newEntry("projects", v.ID, nil, domain.EntryKindFolder, "Other", "other")
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, dupID) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate entry ID code = %v, want FILE_CONFLICT", err)
	}
	dupChild := newEntry("docs-2", v.ID, &projects.ID, domain.EntryKindFolder, "docs", "docs")
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, dupChild) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate child name code = %v, want FILE_CONFLICT", err)
	}
	// Same name under another Vault's root succeeds: uniqueness is per Vault.
	seedEntry(t, ctx, store, newEntry("projects-w", other.ID, nil, domain.EntryKindFolder, "Projects", "projects"))
	// Same name in a different folder of the same Vault succeeds.
	seedEntry(t, ctx, store, newEntry("docs-root", v.ID, nil, domain.EntryKindFolder, "Docs", "docs"))

	for _, tc := range []struct {
		name  string
		entry domain.Entry
		code  domain.Code
	}{
		{"missing parent", newEntry("x1", v.ID, new("nope"), domain.EntryKindFolder, "X", "x"), domain.CodeInvalidParent},
		{"cross-vault parent", newEntry("x2", other.ID, &projects.ID, domain.EntryKindFolder, "X", "x"), domain.CodeInvalidParent},
		{"file-kind parent", newEntry("x3", v.ID, new("notes-file"), domain.EntryKindFolder, "X", "x"), domain.CodeInvalidParent},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, tc.entry) })
			if code := codeOf(t, err); code != tc.code {
				t.Fatalf("code = %q, want %q", code, tc.code)
			}
		})
	}
	missingVault := newEntry("x4", "no-vault", nil, domain.EntryKindFolder, "X", "x")
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertEntry(ctx, missingVault) }); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing Vault code = %v, want NOT_FOUND", err)
	}
}

// A rename preserves identity and children while changing display name, key
// and timestamp; a collision fails with FILE_CONFLICT and leaves the old
// name in place. A case-only rename is allowed.
func TestRenameEntryPreservesAndRollsBack(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	parent := seedEntry(t, ctx, store, newEntry("projects", v.ID, nil, domain.EntryKindFolder, "Projects", "projects"))
	docs := seedEntry(t, ctx, store, newEntry("docs", v.ID, &parent.ID, domain.EntryKindFolder, "Docs", "docs"))
	seedEntry(t, ctx, store, newEntry("notes", v.ID, &parent.ID, domain.EntryKindFolder, "Notes", "notes"))

	renamedAt := millisNow().Add(time.Second)
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.RenameEntry(ctx, "docs", "Documents", "documents", renamedAt)
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetEntry(ctx, "docs")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Documents" || got.NameKey != "documents" {
		t.Fatalf("renamed = %+v, want Documents/documents", got)
	}
	if got.UpdatedAt.UnixMilli() != renamedAt.UnixMilli() {
		t.Fatalf("updated_at = %v, want %v", got.UpdatedAt, renamedAt)
	}
	if got.ParentID == nil || *got.ParentID != parent.ID || !got.CreatedAt.Equal(docs.CreatedAt) {
		t.Fatalf("rename must preserve parent and created_at: %+v", got)
	}

	// Case-only rename keeps the same row.
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.RenameEntry(ctx, "docs", "DOCUMENTS", "documents", millisNow())
	}); err != nil {
		t.Fatalf("case-only rename: %v", err)
	}

	// Collision: the failed rename leaves the old name in place.
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.RenameEntry(ctx, "docs", "Notes", "notes", millisNow())
	}); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("rename collision code = %v, want FILE_CONFLICT", err)
	}
	kept, err := store.GetEntry(ctx, "docs")
	if err != nil {
		t.Fatal(err)
	}
	if kept.Name != "DOCUMENTS" || kept.NameKey != "documents" {
		t.Fatalf("failed rename changed the row: %+v", kept)
	}

	// Same exact name is a no-op success.
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.RenameEntry(ctx, "docs", "DOCUMENTS", "documents", millisNow())
	}); err != nil {
		t.Fatalf("same-name rename: %v", err)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.RenameEntry(ctx, "missing", "X", "x", millisNow())
	}); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("rename missing code = %v, want NOT_FOUND", err)
	}
}

// A move re-parents within the same Vault, back to the root with a nil
// parent, and rejects self/cross-vault/non-folder/missing destinations with
// INVALID_PARENT. A destination name collision fails atomically.
func TestMoveEntryAcrossParents(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	other := seedMetadataOnlyVault(t, ctx, store, "vault-2", "Work")
	a := seedEntry(t, ctx, store, newEntry("a", v.ID, nil, domain.EntryKindFolder, "A", "a"))
	b := seedEntry(t, ctx, store, newEntry("b", v.ID, nil, domain.EntryKindFolder, "B", "b"))
	child := seedEntry(t, ctx, store, newEntry("child", v.ID, &a.ID, domain.EntryKindFolder, "Child", "child"))
	file := seedEntry(t, ctx, store, newEntry("f", v.ID, nil, domain.EntryKindFile, "F", "f"))
	foreign := seedEntry(t, ctx, store, newEntry("foreign", other.ID, nil, domain.EntryKindFolder, "Foreign", "foreign"))

	movedAt := millisNow().Add(time.Second)
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.MoveEntry(ctx, "child", &b.ID, movedAt)
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetEntry(ctx, "child")
	if err != nil {
		t.Fatal(err)
	}
	if got.ParentID == nil || *got.ParentID != "b" || got.UpdatedAt.UnixMilli() != movedAt.UnixMilli() {
		t.Fatalf("moved = %+v, want parent b", got)
	}
	_ = child
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.MoveEntry(ctx, "child", nil, millisNow())
	}); err != nil {
		t.Fatal(err)
	}
	if got, _ := store.GetEntry(ctx, "child"); got.ParentID != nil {
		t.Fatalf("move to root keeps parent: %+v", got)
	}

	for _, tc := range []struct {
		name   string
		id     string
		parent *string
		code   domain.Code
	}{
		{"self destination", "a", new("a"), domain.CodeInvalidParent},
		{"missing destination", "a", new("nope"), domain.CodeInvalidParent},
		{"cross-vault destination", "a", &foreign.ID, domain.CodeInvalidParent},
		{"non-folder destination", "a", &file.ID, domain.CodeInvalidParent},
		{"missing entry", "missing", &b.ID, domain.CodeNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := store.WithTx(ctx, func(tx *Tx) error {
				return tx.MoveEntry(ctx, tc.id, tc.parent, millisNow())
			})
			if code := codeOf(t, err); code != tc.code {
				t.Fatalf("code = %q, want %q", code, tc.code)
			}
		})
	}

	// Destination collision: the hierarchy is unchanged.
	seedEntry(t, ctx, store, newEntry("clash", v.ID, &b.ID, domain.EntryKindFolder, "A", "a"))
	sibling := seedEntry(t, ctx, store, newEntry("sibling", v.ID, nil, domain.EntryKindFolder, "Sibling", "sibling"))
	_ = sibling
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.MoveEntry(ctx, "a", &b.ID, millisNow())
	}); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("move collision code = %v, want FILE_CONFLICT", err)
	}
	kept, err := store.GetEntry(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	if kept.ParentID != nil {
		t.Fatalf("failed move changed the parent: %+v", kept)
	}
}

// Deleting a leaf removes it; dependents (children, file records, job
// references) block deletion with OPERATION_UNAVAILABLE via RESTRICT.
func TestDeleteEntryDependencies(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	parent := seedEntry(t, ctx, store, newEntry("parent", v.ID, nil, domain.EntryKindFolder, "Parent", "parent"))
	seedEntry(t, ctx, store, newEntry("kid", v.ID, &parent.ID, domain.EntryKindFolder, "Kid", "kid"))
	fileEntry := seedEntry(t, ctx, store, newEntry("file-e", v.ID, nil, domain.EntryKindFile, "F", "f"))
	now := millisNow()
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.InsertFile(ctx, domain.File{EntryID: fileEntry.ID, WrappedFileKey: []byte{9, 9}, ChunkSize: 8, CreatedAt: now})
	}); err != nil {
		t.Fatal(err)
	}
	jobbed := seedEntry(t, ctx, store, newEntry("jobbed", v.ID, nil, domain.EntryKindFolder, "Jobbed", "jobbed"))
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.InsertJob(ctx, domain.Job{ID: "job-1", Type: domain.JobTypeVerify, VaultID: v.ID, EntryID: &jobbed.ID, State: domain.JobStateQueued, CreatedAt: now, UpdatedAt: now})
	}); err != nil {
		t.Fatal(err)
	}

	for _, id := range []string{"parent", "file-e", "jobbed"} {
		if err := store.WithTx(ctx, func(tx *Tx) error { return tx.DeleteEntry(ctx, id) }); codeOf(t, err) != domain.CodeOperationUnavailable {
			t.Fatalf("delete %s code = %v, want OPERATION_UNAVAILABLE", id, err)
		}
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.DeleteEntry(ctx, "kid") }); err != nil {
		t.Fatal(err)
	}
	if _, err := store.GetEntry(ctx, "kid"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("deleted row still readable: %v", err)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.DeleteEntry(ctx, "missing") }); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("delete missing code = %v, want NOT_FOUND", err)
	}
}

// File records attach to file-kind entries only and round-trip intact,
// including a nil SHA-256. Folder kinds are INVALID_PARENT.
func TestFileRecordValidatesFileKind(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	fileEntry := seedEntry(t, ctx, store, newEntry("file-e", v.ID, nil, domain.EntryKindFile, "F", "f"))
	folder := seedEntry(t, ctx, store, newEntry("folder", v.ID, nil, domain.EntryKindFolder, "G", "g"))

	now := millisNow()
	// Synthetic wrapped-key bytes exercise the metadata contract; they are
	// never advertised as cryptographically valid keys.
	want := domain.File{EntryID: fileEntry.ID, WrappedFileKey: []byte{1, 2, 3, 4}, ChunkSize: 16777216, ChunkCount: 2, CreatedAt: now}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertFile(ctx, want) }); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetFile(ctx, fileEntry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.EntryID != want.EntryID || string(got.WrappedFileKey) != string(want.WrappedFileKey) ||
		got.ChunkSize != want.ChunkSize || got.ChunkCount != want.ChunkCount || got.SHA256 != nil ||
		got.CreatedAt.UnixMilli() != now.UnixMilli() {
		t.Fatalf("GetFile = %+v, want %+v", got, want)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		if _, err := tx.GetFile(ctx, fileEntry.ID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		t.Fatalf("Tx.GetFile: %v", err)
	}

	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.InsertFile(ctx, domain.File{EntryID: folder.ID, WrappedFileKey: []byte{5}, ChunkSize: 8, CreatedAt: now})
	}); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("folder file-record code = %v, want INVALID_PARENT", err)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.InsertFile(ctx, domain.File{EntryID: "missing", WrappedFileKey: []byte{5}, ChunkSize: 8, CreatedAt: now})
	}); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("missing entry file-record code = %v, want NOT_FOUND", err)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertFile(ctx, want) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate file-record code = %v, want FILE_CONFLICT", err)
	}
	if _, err := store.GetFile(ctx, "missing"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("GetFile missing code = %v, want NOT_FOUND", err)
	}
}

// Chunk metadata lists ordered by chunk index; duplicate indexes and unknown
// file records reject. Backend references are synthetic test values, never
// real backend objects.
func TestChunkMetadataOrderedAndUnique(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	fileEntry := seedEntry(t, ctx, store, newEntry("file-e", v.ID, nil, domain.EntryKindFile, "F", "f"))
	now := millisNow()
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.InsertFile(ctx, domain.File{EntryID: fileEntry.ID, WrappedFileKey: []byte{7}, ChunkSize: 8, ChunkCount: 3, CreatedAt: now})
	}); err != nil {
		t.Fatal(err)
	}

	newChunk := func(id string, index int64) domain.Chunk {
		return domain.Chunk{
			ID: id, FileEntryID: fileEntry.ID, ChunkIndex: index,
			BackendType: "synthetic-test", MessageID: "test-msg-" + id, AttachmentID: "test-att-" + id, RemoteName: "remote-" + id,
			Nonce: bytes24(byte(index + 1)), PlaintextSize: 100, CiphertextSize: 128,
			PlaintextSHA256: bytes32(byte(index + 1)), CreatedAt: now,
		}
	}
	// Insert out of order; listing still returns index order.
	for _, c := range []domain.Chunk{newChunk("c2", 2), newChunk("c0", 0), newChunk("c1", 1)} {
		if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertChunk(ctx, c) }); err != nil {
			t.Fatalf("insert chunk %d: %v", c.ChunkIndex, err)
		}
	}
	listed, err := store.ListChunks(ctx, fileEntry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 3 || listed[0].ChunkIndex != 0 || listed[1].ChunkIndex != 1 || listed[2].ChunkIndex != 2 {
		t.Fatalf("ListChunks order = %+v, want indexes 0,1,2", listed)
	}
	if len(listed[0].Nonce) != 24 || len(listed[0].PlaintextSHA256) != 32 {
		t.Fatalf("chunk integrity lengths = %d/%d, want 24/32", len(listed[0].Nonce), len(listed[0].PlaintextSHA256))
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		txListed, err := tx.ListChunks(ctx, fileEntry.ID)
		if err != nil {
			return err
		}
		if len(txListed) != 3 {
			t.Fatalf("Tx.ListChunks has %d rows, want 3", len(txListed))
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	dup := newChunk("c9", 1)
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertChunk(ctx, dup) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate chunk index code = %v, want FILE_CONFLICT", err)
	}
	orphan := newChunk("orphan", 0)
	orphan.FileEntryID = "missing"
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertChunk(ctx, orphan) }); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("orphan chunk code = %v, want NOT_FOUND", err)
	}
	if listed, err := store.ListChunks(ctx, fileEntry.ID); err != nil || len(listed) != 3 {
		t.Fatalf("ListChunks after rejects = %d rows, %v; want 3, nil", len(listed), err)
	}
}

func bytes24(seed byte) []byte {
	b := make([]byte, 24)
	for i := range b {
		b[i] = seed + byte(i)
	}
	return b
}

func bytes32(seed byte) []byte {
	b := make([]byte, 32)
	for i := range b {
		b[i] = seed + byte(i)
	}
	return b
}

// Jobs insert against same-Vault entries only, then UpdateJob performs a
// compare-and-swap milestone update: progress/error/timestamps move only on
// a matching stored state, identity is immutable, invalid progress and
// terminal jobs reject, and a failed update changes nothing.
func TestJobLifecycleCompareAndSwap(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	v := seedMetadataOnlyVault(t, ctx, store, "vault-1", "Personal")
	other := seedMetadataOnlyVault(t, ctx, store, "vault-2", "Work")
	entry := seedEntry(t, ctx, store, newEntry("entry", v.ID, nil, domain.EntryKindFolder, "E", "e"))
	foreign := seedEntry(t, ctx, store, newEntry("foreign", other.ID, nil, domain.EntryKindFolder, "F", "f"))

	now := millisNow()
	newJob := func(id string) domain.Job {
		return domain.Job{
			ID: id, Type: domain.JobTypeUpload, VaultID: v.ID, EntryID: &entry.ID,
			State:          domain.JobStateQueued,
			BytesTotal:     100,
			BytesCompleted: 40, ItemsTotal: 3, ItemsCompleted: 1,
			CreatedAt: now, UpdatedAt: now,
		}
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, newJob("job-1")) }); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetJob(ctx, "job-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Type != domain.JobTypeUpload || got.VaultID != v.ID || got.EntryID == nil || *got.EntryID != entry.ID ||
		got.BytesTotal != 100 || got.BytesCompleted != 40 || got.ItemsTotal != 3 || got.ItemsCompleted != 1 {
		t.Fatalf("GetJob = %+v, want the inserted progress", got)
	}
	listed, err := store.ListJobs(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 1 || listed[0].ID != "job-1" {
		t.Fatalf("ListJobs = %+v, want [job-1]", listed)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		if _, err := tx.GetJob(ctx, "job-1"); err != nil {
			return err
		}
		if _, err := tx.ListJobs(ctx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		t.Fatalf("Tx job reads: %v", err)
	}
	if _, err := store.GetJob(ctx, "missing"); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("GetJob missing code = %v, want NOT_FOUND", err)
	}

	badVault := newJob("bad-vault")
	badVault.VaultID = "no-vault"
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, badVault) }); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("job missing Vault code = %v, want NOT_FOUND", err)
	}
	badEntry := newJob("bad-entry")
	badEntry.EntryID = new("no-entry")
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, badEntry) }); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("job missing entry code = %v, want NOT_FOUND", err)
	}
	crossVault := newJob("cross-vault")
	crossVault.EntryID = &foreign.ID
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, crossVault) }); codeOf(t, err) != domain.CodeInvalidParent {
		t.Fatalf("job cross-vault entry code = %v, want INVALID_PARENT", err)
	}
	for _, tc := range []struct {
		name string
		mut  func(*domain.Job)
	}{
		{"negative progress", func(j *domain.Job) { j.BytesCompleted = -1 }},
		{"completed above total", func(j *domain.Job) { j.BytesCompleted = 101 }},
		{"items above total", func(j *domain.Job) { j.ItemsCompleted = 4 }},
	} {
		t.Run("insert "+tc.name, func(t *testing.T) {
			j := newJob("progress-" + tc.name)
			tc.mut(&j)
			err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, j) })
			if code := codeOf(t, err); code != domain.CodeInvalidState {
				t.Fatalf("code = %q, want INVALID_STATE", code)
			}
		})
	}
	if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, newJob("job-1")) }); codeOf(t, err) != domain.CodeFileConflict {
		t.Fatalf("duplicate job code = %v, want FILE_CONFLICT", err)
	}

	// Milestone progress update on a matching state succeeds.
	progressed := newJob("job-1")
	progressed.BytesCompleted = 60
	progressed.ItemsCompleted = 2
	progressed.UpdatedAt = millisNow().Add(time.Second)
	progressed.ErrorMessage = new("slow backend")
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.UpdateJob(ctx, progressed, domain.JobStateQueued)
	}); err != nil {
		t.Fatalf("milestone update: %v", err)
	}
	stored, err := store.GetJob(ctx, "job-1")
	if err != nil {
		t.Fatal(err)
	}
	if stored.BytesCompleted != 60 || stored.ItemsCompleted != 2 || stored.ErrorMessage == nil || *stored.ErrorMessage != "slow backend" {
		t.Fatalf("stored after milestone = %+v, want updated progress", stored)
	}

	// Every other UpdateJob shape rejects and changes nothing.
	before := stored
	reject := func(name string, job domain.Job, expected domain.JobState) {
		t.Helper()
		err := store.WithTx(ctx, func(tx *Tx) error { return tx.UpdateJob(ctx, job, expected) })
		if code := codeOf(t, err); code != domain.CodeInvalidState {
			t.Fatalf("%s code = %v, want INVALID_STATE", name, err)
		}
	}
	stale := before
	stale.BytesCompleted = 70
	reject("stale expectation", stale, domain.JobStateRunning)
	moved := before
	moved.State = domain.JobStateRunning
	reject("state change", moved, domain.JobStateQueued)
	renamed := before
	renamed.Type = domain.JobTypeDownload
	reject("type change", renamed, domain.JobStateQueued)
	jumped := before
	jumped.VaultID = other.ID
	reject("vault change", jumped, domain.JobStateQueued)
	swapped := before
	swapped.EntryID = &foreign.ID
	reject("entry change", swapped, domain.JobStateQueued)
	over := before
	over.BytesCompleted = 500
	reject("invalid progress", over, domain.JobStateQueued)
	neg := before
	neg.ItemsCompleted = -2
	reject("negative progress", neg, domain.JobStateQueued)
	after, err := store.GetJob(ctx, "job-1")
	if err != nil {
		t.Fatal(err)
	}
	if after.BytesCompleted != before.BytesCompleted || after.ItemsCompleted != before.ItemsCompleted {
		t.Fatalf("rejected updates mutated the row: %+v", after)
	}
	if err := store.WithTx(ctx, func(tx *Tx) error {
		return tx.UpdateJob(ctx, newJob("missing"), domain.JobStateQueued)
	}); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("update missing code = %v, want NOT_FOUND", err)
	}

	// Terminal states accept no writes.
	for _, state := range []domain.JobState{domain.JobStateCompleted, domain.JobStateCancelled} {
		id := "terminal-" + string(state)
		j := newJob(id)
		j.State = state
		if err := store.WithTx(ctx, func(tx *Tx) error { return tx.InsertJob(ctx, j) }); err != nil {
			t.Fatalf("seed terminal job: %v", err)
		}
		j.BytesCompleted = 80
		if err := store.WithTx(ctx, func(tx *Tx) error { return tx.UpdateJob(ctx, j, state) }); codeOf(t, err) != domain.CodeInvalidState {
			t.Fatalf("terminal %s write code = %v, want INVALID_STATE", state, err)
		}
	}
}

// An injected error after several writes leaves every write absent: the
// transaction is atomic.
func TestWithTxRollbackOnError(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	vault := seedMetadataOnlyVaultSource("vault-rollback", "Rollback")
	entry := newEntry("rollback-entry", vault.ID, nil, domain.EntryKindFolder, "R", "r")
	injected := errors.New("injected failure")
	err := store.WithTx(ctx, func(tx *Tx) error {
		if err := tx.InsertVault(ctx, vault); err != nil {
			return err
		}
		if err := tx.InsertEntry(ctx, entry); err != nil {
			return err
		}
		return injected
	})
	if err != injected {
		t.Fatalf("WithTx error = %v, want the injected failure", err)
	}
	if _, err := store.GetVault(ctx, vault.ID); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("rolled-back Vault still present: %v", err)
	}
	if _, err := store.GetEntry(ctx, entry.ID); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("rolled-back entry still present: %v", err)
	}
}

// A panic inside WithTx still rolls back before propagating.
func TestWithTxRollbackOnPanic(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	vault := seedMetadataOnlyVaultSource("vault-panic", "Panic")
	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("WithTx must re-panic")
			}
		}()
		_ = store.WithTx(ctx, func(tx *Tx) error {
			if err := tx.InsertVault(ctx, vault); err != nil {
				t.Fatalf("seed inside panic test: %v", err)
			}
			panic("boom")
		})
	}()
	if _, err := store.GetVault(ctx, vault.ID); codeOf(t, err) != domain.CodeNotFound {
		t.Fatalf("panicked transaction left its Vault: %v", err)
	}
}

// A nil transaction function is a safe DATABASE_UNAVAILABLE, not a crash.
func TestWithTxNilFunction(t *testing.T) {
	ctx := context.Background()
	store := openMetadataStore(t, ctx)
	if code := codeOf(t, store.WithTx(ctx, nil)); code != domain.CodeDatabaseUnavailable {
		t.Fatalf("nil fn code = %q, want DATABASE_UNAVAILABLE", code)
	}
}

// A production version-1 database holding a setting upgrades to version 2,
// retains the row, and serves the new metadata tables.
func TestMigrateProductionV1ToV2PreservesSettings(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store, err := Open(ctx, filepath.Join(dir, "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	prod0001, err := fs.ReadFile(migrations.FS, "0001_foundation.sql")
	if err != nil {
		t.Fatal(err)
	}
	v1 := fstest.MapFS{"0001_foundation.sql": {Data: prod0001}}
	backups := filepath.Join(dir, "backups")
	if err := Migrate(ctx, store, v1, backups); err != nil {
		t.Fatal(err)
	}
	mustExec(t, ctx, store, `INSERT INTO settings(key, value) VALUES('theme', 'dark');`)
	if err := Migrate(ctx, store, migrations.FS, backups); err != nil {
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
		t.Fatalf("setting value = %q, want %q after v1->v2 upgrade", value, "dark")
	}
	if !tableExists(ctx, t, store, "vaults") || !tableExists(ctx, t, store, "entries") ||
		!tableExists(ctx, t, store, "files") || !tableExists(ctx, t, store, "chunks") || !tableExists(ctx, t, store, "jobs") {
		t.Fatal("v2 metadata tables must exist after the production upgrade")
	}
	seedMetadataOnlyVault(t, ctx, store, "vault-upgraded", "Upgraded")
	if _, err := store.GetVault(ctx, "vault-upgraded"); err != nil {
		t.Fatalf("metadata-only Vault after upgrade: %v", err)
	}
}

// A failing 0002 rolls back entirely: version, data, and schema stay at v1.
func TestMigrateFailing0002RollsBack(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store, err := Open(ctx, filepath.Join(dir, "wyvern.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	prod0001, err := fs.ReadFile(migrations.FS, "0001_foundation.sql")
	if err != nil {
		t.Fatal(err)
	}
	v1 := fstest.MapFS{"0001_foundation.sql": {Data: prod0001}}
	backups := filepath.Join(dir, "backups")
	if err := Migrate(ctx, store, v1, backups); err != nil {
		t.Fatal(err)
	}
	mustExec(t, ctx, store, `INSERT INTO settings(key, value) VALUES('theme', 'dark');`)
	bad := fstest.MapFS{
		"0001_foundation.sql": {Data: prod0001},
		"0002_broken.sql":     {Data: []byte("CREATE TABLE ok(a TEXT); THIS IS NOT SQL;")},
	}
	if err := Migrate(ctx, store, bad, backups); err == nil {
		t.Fatal("expected the broken 0002 to fail, got nil")
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
	for _, name := range []string{"vaults", "entries", "files", "chunks", "jobs", "ok"} {
		if tableExists(ctx, t, store, name) {
			t.Fatalf("failed 0002 left table %q behind", name)
		}
	}
}
